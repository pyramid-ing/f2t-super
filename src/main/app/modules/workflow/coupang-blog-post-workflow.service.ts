import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CoupangCrawlerService } from '../coupang-crawler/coupang-crawler.service'
import { CoupangBlogPostJobService } from '../job/coupang-blog-post-job/coupang-blog-post-job.service'
import { CreateCoupangBlogPostJobDto } from '@main/app/modules/job/coupang-blog-post-job/dto'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export enum BlogType {
  WORDPRESS = 'wordpress',
  TISTORY = 'tistory',
  GOOGLE_BLOG = 'google_blog',
}

export interface CoupangBlogExcelRow {
  // 수동 URL 모드
  쿠팡url?: string

  // 검색 모드
  쿠팡검색어?: string
  쿠팡검색수?: string | number

  // 공통
  발행블로그유형: string
  발행블로그이름: string
  예약날짜?: string
  카테고리?: string
  등록상태?: string // '공개' | '비공개' (기본: 공개)
}

export interface CoupangBlogWorkflowResult {
  success: number
  failed: number
  errors: string[]
  jobIds: string[]
}

@Injectable()
export class CoupangBlogPostWorkflowService {
  private readonly logger = new Logger(CoupangBlogPostWorkflowService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupangBlogPostJobService: CoupangBlogPostJobService,
    private readonly coupangCrawler: CoupangCrawlerService,
  ) {}

  /**
   * 블로그 타입을 파싱합니다.
   */
  public parseBlogType(value: string): BlogType {
    const normalizedValue = value.toLowerCase().trim()

    switch (normalizedValue) {
      case 'wordpress':
      case '워드프레스':
        return BlogType.WORDPRESS
      case 'tistory':
      case '티스토리':
        return BlogType.TISTORY
      case 'google_blog':
      case '구글':
      case '블로거':
      case '블로그스팟':
      case '구글블로그':
        return BlogType.GOOGLE_BLOG
      default:
        assert(false, `지원하지 않는 블로그 타입입니다: ${value}`)
    }
  }

  /**
   * 날짜를 파싱합니다.
   */
  private parseDate(value: any): Date | null {
    if (!value) return null

    if (value instanceof Date) {
      return value
    }

    if (typeof value === 'string') {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return date
      }
    }

    if (typeof value === 'number') {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return date
      }
    }

    return null
  }

  /**
   * 발행 아이디를 검증하고 해당 계정을 찾습니다.
   */
  async validatePublishId(blogType: BlogType, name: string): Promise<{ accountId: number; accountName: string }> {
    try {
      switch (blogType) {
        case BlogType.GOOGLE_BLOG:
          const bloggerAccount = await this.prisma.bloggerAccount.findFirst({
            where: { name },
          })
          assert(bloggerAccount, `Blogger 계정을 찾을 수 없습니다: ${name}`)
          return { accountId: bloggerAccount.id, accountName: bloggerAccount.name }

        case BlogType.TISTORY:
          const tistoryAccount = await this.prisma.tistoryAccount.findFirst({
            where: { name },
          })
          assert(tistoryAccount, `Tistory 계정을 찾을 수 없습니다: ${name}`)
          return { accountId: tistoryAccount.id, accountName: tistoryAccount.name }

        case BlogType.WORDPRESS:
          const wordpressAccount = await this.prisma.wordPressAccount.findFirst({
            where: { name },
          })
          assert(wordpressAccount, `WordPress 계정을 찾을 수 없습니다: ${name}`)
          return { accountId: wordpressAccount.id, accountName: wordpressAccount.name }

        default:
          assert(false, `지원하지 않는 블로그 타입입니다: ${blogType}`)
      }
    } catch (error) {
      this.logger.error(`발행 아이디 검증 실패: ${name}`, error)
      throw error
    }
  }

  /**
   * 엑셀 데이터를 기반으로 쿠팡 블로그 작업을 일괄 생성합니다.
   */
  async bulkCreate(rows: CoupangBlogExcelRow[], immediateRequest: boolean = true): Promise<CoupangBlogWorkflowResult> {
    const results: CoupangBlogWorkflowResult = {
      success: 0,
      failed: 0,
      errors: [],
      jobIds: [],
    }

    // 기본 계정 조회 (없을 수 있으므로 null 허용)
    const [defaultTistory, defaultWordpress, defaultBlogger] = await Promise.all([
      this.prisma.tistoryAccount.findFirst({ where: { isDefault: true } }),
      this.prisma.wordPressAccount.findFirst({ where: { isDefault: true } }),
      this.prisma.bloggerAccount.findFirst({ where: { isDefault: true } }),
    ])

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // 엑셀 행 번호 (헤더 제외)

      try {
        this.logger.log(
          `행 ${rowNumber} 처리 시작: ` +
            (row.쿠팡검색어
              ? `검색모드(keyword='${row.쿠팡검색어}', count='${row.쿠팡검색수 || ''}')`
              : `URL='${row.쿠팡url || ''}'`),
        )

        // 계정/타입 결정: 입력값 없으면 기본 계정 자동 적용
        let selectedBlogType: BlogType
        let accountInfo: { accountId: number; accountName: string }

        if (row.발행블로그유형 && row.발행블로그이름) {
          // 둘 다 지정된 경우 기존 로직 유지
          const blogTypeParsed = this.parseBlogType(row.발행블로그유형)
          selectedBlogType = blogTypeParsed
          accountInfo = await this.validatePublishId(blogTypeParsed, row.발행블로그이름)
        } else if (row.발행블로그유형 && !row.발행블로그이름) {
          // 타입만 지정된 경우: 해당 타입의 기본 계정 → 없으면 다른 기본으로 폴백
          const blogTypeParsed = this.parseBlogType(row.발행블로그유형)
          selectedBlogType = blogTypeParsed
          switch (blogTypeParsed) {
            case BlogType.TISTORY:
              if (defaultTistory) {
                accountInfo = { accountId: defaultTistory.id, accountName: defaultTistory.name }
                break
              }
              if (defaultWordpress) {
                selectedBlogType = BlogType.WORDPRESS
                accountInfo = { accountId: defaultWordpress.id, accountName: defaultWordpress.name }
                break
              }
              if (defaultBlogger) {
                selectedBlogType = BlogType.GOOGLE_BLOG
                accountInfo = { accountId: defaultBlogger.id, accountName: defaultBlogger.name }
                break
              }
              throw new Error('기본 블로그 계정이 설정되어 있지 않습니다.')
            case BlogType.WORDPRESS:
              if (defaultWordpress) {
                accountInfo = { accountId: defaultWordpress.id, accountName: defaultWordpress.name }
                break
              }
              if (defaultTistory) {
                selectedBlogType = BlogType.TISTORY
                accountInfo = { accountId: defaultTistory.id, accountName: defaultTistory.name }
                break
              }
              if (defaultBlogger) {
                selectedBlogType = BlogType.GOOGLE_BLOG
                accountInfo = { accountId: defaultBlogger.id, accountName: defaultBlogger.name }
                break
              }
              throw new Error('기본 블로그 계정이 설정되어 있지 않습니다.')
            case BlogType.GOOGLE_BLOG:
              if (defaultBlogger) {
                accountInfo = { accountId: defaultBlogger.id, accountName: defaultBlogger.name }
                break
              }
              if (defaultTistory) {
                selectedBlogType = BlogType.TISTORY
                accountInfo = { accountId: defaultTistory.id, accountName: defaultTistory.name }
                break
              }
              if (defaultWordpress) {
                selectedBlogType = BlogType.WORDPRESS
                accountInfo = { accountId: defaultWordpress.id, accountName: defaultWordpress.name }
                break
              }
              throw new Error('기본 블로그 계정이 설정되어 있지 않습니다.')
            default:
              // 파싱 실패 시 어떤 기본이든 적용
              if (defaultTistory) {
                selectedBlogType = BlogType.TISTORY
                accountInfo = { accountId: defaultTistory.id, accountName: defaultTistory.name }
              } else if (defaultWordpress) {
                selectedBlogType = BlogType.WORDPRESS
                accountInfo = { accountId: defaultWordpress.id, accountName: defaultWordpress.name }
              } else if (defaultBlogger) {
                selectedBlogType = BlogType.GOOGLE_BLOG
                accountInfo = { accountId: defaultBlogger.id, accountName: defaultBlogger.name }
              } else {
                throw new Error('기본 블로그 계정이 설정되어 있지 않습니다.')
              }
          }
        } else {
          // 타입/이름 모두 미지정: 기본 우선순위로 선택 (티스토리 > 워드프레스 > 블로거)
          if (defaultTistory) {
            selectedBlogType = BlogType.TISTORY
            accountInfo = { accountId: defaultTistory.id, accountName: defaultTistory.name }
          } else if (defaultWordpress) {
            selectedBlogType = BlogType.WORDPRESS
            accountInfo = { accountId: defaultWordpress.id, accountName: defaultWordpress.name }
          } else if (defaultBlogger) {
            selectedBlogType = BlogType.GOOGLE_BLOG
            accountInfo = { accountId: defaultBlogger.id, accountName: defaultBlogger.name }
          } else {
            throw new Error('기본 블로그 계정이 설정되어 있지 않습니다.')
          }
        }

        // create 단계에서 타입 미지정 문제 방지 위해 보정된 행 객체 사용
        const rowForCreate: CoupangBlogExcelRow = {
          ...row,
          발행블로그유형: (() => {
            switch (selectedBlogType) {
              case BlogType.TISTORY:
                return 'tistory'
              case BlogType.WORDPRESS:
                return 'wordpress'
              case BlogType.GOOGLE_BLOG:
              default:
                return 'google_blog'
            }
          })(),
          발행블로그이름: accountInfo.accountName,
        }

        // 작업 생성 경로 분기: 검색모드/수동 URL 모드
        let jobId: string
        if (row.쿠팡검색어 && row.쿠팡검색어.trim() !== '') {
          const limit = Math.min(10, Math.max(1, parseInt(String(row.쿠팡검색수 || '5'), 10) || 5))
          const searchResults = await this.searchCoupangProducts(row.쿠팡검색어.trim(), limit)
          const urls = searchResults.map(r => r.url).filter(Boolean)
          if (urls.length === 0) {
            throw new Error(`쿠팡검색어로 URL을 찾지 못했습니다: ${row.쿠팡검색어}`)
          }
          this.logger.log(`행 ${rowNumber} 검색결과 ${urls.length}건 → 상위 ${limit}건 등록`)
          jobId = await this.createCoupangBlogJob(rowForCreate, accountInfo, immediateRequest, urls)
        } else {
          jobId = await this.createCoupangBlogJob(rowForCreate, accountInfo, immediateRequest)
        }

        results.success++
        results.jobIds.push(jobId)
        this.logger.log(`행 ${rowNumber} 처리 완료`)
      } catch (error) {
        results.failed++
        const errorMessage = `행 ${rowNumber}: ${error.message}`
        results.errors.push(errorMessage)
        this.logger.error(errorMessage, error)
      }
    }

    return results
  }

  /**
   * 키워드 기반 쿠팡 검색 → 상위 N개 URL 반환
   */
  async searchCoupangProducts(
    keyword: string,
    limit: number = 5,
  ): Promise<{ rank: number; title: string; price: number; isRocket: boolean; url: string }[]> {
    const results = await this.coupangCrawler.crawlProductList(keyword, limit)
    return results
  }

  /**
   * 쿠팡 블로그 작업을 생성합니다.
   */
  private async createCoupangBlogJob(
    row: CoupangBlogExcelRow,
    accountInfo: { accountId: number; accountName: string },
    immediateRequest: boolean = true,
    overrideUrls?: string[],
  ): Promise<string> {
    // 블로그 타입에 따른 계정 ID 설정
    const blogType = this.parseBlogType(row.발행블로그유형)
    let bloggerAccountId: number | undefined
    let wordpressAccountId: number | undefined
    let tistoryAccountId: number | undefined

    switch (blogType) {
      case BlogType.GOOGLE_BLOG:
        bloggerAccountId = accountInfo.accountId
        break
      case BlogType.TISTORY:
        tistoryAccountId = accountInfo.accountId
        break
      case BlogType.WORDPRESS:
        wordpressAccountId = accountInfo.accountId
        break
    }

    // URL 분기: 줄바꿈으로 여러 개가 들어오면 비교형으로 등록
    const urls: string[] = (() => {
      if (overrideUrls && overrideUrls.length > 0) return overrideUrls
      const rawUrl = (row.쿠팡url || '').trim()
      return rawUrl
        .split(/\r?\n/)
        .map(u => u.trim())
        .filter(u => u.length > 0)
    })()

    // CoupangBlogPostJobService를 사용하여 작업 생성
    const createJobDto: CreateCoupangBlogPostJobDto = {
      subject: `쿠팡 상품 리뷰 포스팅`,
      desc: `워크플로우로 생성된 쿠팡 상품 리뷰 포스팅 작업`,
      coupangUrls: urls.length > 0 ? urls : [],
      title: '', // 실제 제목은 작업 처리 시 크롤링으로 생성
      content: '', // AI로 생성될 예정
      category: row.카테고리,
      scheduledAt: row.예약날짜 ? this.parseDate(row.예약날짜)?.toISOString() : undefined,
      bloggerAccountId,
      wordpressAccountId,
      tistoryAccountId,
      immediateRequest,
    }

    // 등록상태(공개/비공개)에 따라 계정 기본값을 덮어쓸 수 있도록,
    // 쿠팡 잡은 발행 시 계정 기본값을 사용하므로, 여기서는 메타로 상태를 기록하거나
    // 추후 확장 시 잡 데이터에 반영할 수 있게 로그만 남깁니다.
    const publishRaw = (row.등록상태 || '').trim()
    const publishVisibility = publishRaw === '' ? 'public' : publishRaw === '비공개' ? 'private' : 'public'

    this.logger.log(`등록상태 파싱 결과: ${publishVisibility} (row.등록상태='${row.등록상태 || ''}')`)

    const result = await this.coupangBlogPostJobService.createCoupangBlogPostJob(createJobDto)

    this.logger.log(`쿠팡 블로그 작업 생성 완료: ${result.jobId}`)
    return result.jobId
  }
}
