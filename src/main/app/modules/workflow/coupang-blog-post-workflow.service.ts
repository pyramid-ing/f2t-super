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
  BLOGGER = 'blogger',
}

export interface CoupangBlogExcelRow {
  쿠팡url: string
  발행블로그유형: string
  발행블로그이름: string
  예약날짜?: string
  카테고리?: string
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
      case 'blogger':
      case '블로거':
        return BlogType.BLOGGER
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
        case BlogType.BLOGGER:
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
  async bulkCreate(rows: CoupangBlogExcelRow[]): Promise<CoupangBlogWorkflowResult> {
    const results: CoupangBlogWorkflowResult = {
      success: 0,
      failed: 0,
      errors: [],
      jobIds: [],
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // 엑셀 행 번호 (헤더 제외)

      try {
        this.logger.log(`행 ${rowNumber} 처리 시작: ${row.쿠팡url}`)

        // 발행 아이디 검증
        const blogType = this.parseBlogType(row.발행블로그유형)
        const accountInfo = await this.validatePublishId(blogType, row.발행블로그이름)

        // 작업 생성 (크롤링 없이 바로 생성)
        const jobId = await this.createCoupangBlogJob(row, accountInfo)

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
  ): Promise<string> {
    // 블로그 타입에 따른 계정 ID 설정
    const blogType = this.parseBlogType(row.발행블로그유형)
    let bloggerAccountId: number | undefined
    let wordpressAccountId: number | undefined
    let tistoryAccountId: number | undefined

    switch (blogType) {
      case BlogType.BLOGGER:
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
    const rawUrl = (row.쿠팡url || '').trim()
    const splitUrls = rawUrl
      .split(/\r?\n/)
      .map(u => u.trim())
      .filter(u => u.length > 0)

    // CoupangBlogPostJobService를 사용하여 작업 생성
    const createJobDto: CreateCoupangBlogPostJobDto = {
      subject: `쿠팡 상품 리뷰 포스팅`,
      desc: `워크플로우로 생성된 쿠팡 상품 리뷰 포스팅 작업`,
      coupangUrls: splitUrls.length > 0 ? splitUrls : [rawUrl],
      title: '', // 실제 제목은 작업 처리 시 크롤링으로 생성
      content: '', // AI로 생성될 예정
      category: row.카테고리,
      scheduledAt: row.예약날짜 ? this.parseDate(row.예약날짜)?.toISOString() : undefined,
      bloggerAccountId,
      wordpressAccountId,
      tistoryAccountId,
    }

    const result = await this.coupangBlogPostJobService.createCoupangBlogPostJob(createJobDto)

    this.logger.log(`쿠팡 블로그 작업 생성 완료: ${result.jobId}`)
    return result.jobId
  }
}
