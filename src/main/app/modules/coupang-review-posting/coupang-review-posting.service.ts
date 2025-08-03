import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { CoupangCrawlerService } from '../coupang-crawler/coupang-crawler.service'
import { CoupangPartnersService } from '../coupang-partners/coupang-partners.service'
import { ContentGenerateService } from '../content-generate/content-generate.service'
import { WordPressService } from '../wordpress/wordpress.service'
import { TistoryService } from '../tistory/tistory.service'
import { CoupangReviewPostingResult, CoupangProductData, GeneratedContent } from './coupang-review-posting.types'
import {
  CreateCoupangReviewPostingBulkDto,
  CreateCoupangReviewPostingDto,
} from '@main/app/modules/coupang-review-posting/dto'

// CoupangReviewPostingError 클래스 정의
class CoupangReviewPostingErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'CoupangReviewPostingError'
  }
}

@Injectable()
export class CoupangReviewPostingService {
  private readonly logger = new Logger(CoupangReviewPostingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupangCrawler: CoupangCrawlerService,
    private readonly coupangPartners: CoupangPartnersService,
    private readonly contentGenerate: ContentGenerateService,
    private readonly wordpressService: WordPressService,
    private readonly tistoryService: TistoryService,
  ) {}

  /**
   * 단일 쿠팡 리뷰 포스팅 작업 시작
   */
  async startSinglePosting(request: CreateCoupangReviewPostingDto): Promise<CoupangReviewPostingResult> {
    try {
      // TODO 구현
      // this.logger.log(`쿠팡 리뷰 포스팅 시작: ${request.coupangUrl}`)
      //
      // // 1. 유효성 검증
      // await this.validateRequest(request)
      //
      // // 2. Job 생성
      // const job = await this.jobService.createJob({
      //   type: 'coupang-review-posting',
      //   subject: `쿠팡 리뷰 포스팅 - ${request.coupangUrl}`,
      //   desc: `쿠팡 상품 리뷰 기반 블로그 포스팅`,
      //   priority: 1,
      // })
      //
      // // 3. 비동기로 워크플로우 실행
      // this.executeWorkflow(job.id, request).catch(error => {
      //   this.logger.error(`워크플로우 실행 실패 (Job ID: ${job.id}):`, error)
      // })
      //
      // return {
      //   jobId: job.id,
      //   status: 'pending',
      //   message: '쿠팡 리뷰 포스팅 작업이 시작되었습니다.',
      // }
      return {
        jobId: '111',
        status: 'pending',
        message: '쿠팡 리뷰 포스팅 작업이 시작되었습니다.',
      }
    } catch (error) {
      this.logger.error('쿠팡 리뷰 포스팅 시작 실패:', error)
      throw new CoupangReviewPostingErrorClass({
        code: 'POSTING_START_FAILED',
        message: '쿠팡 리뷰 포스팅 작업 시작에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 벌크 쿠팡 리뷰 포스팅 작업 시작
   */
  async startBulkPosting(request: CreateCoupangReviewPostingBulkDto): Promise<CoupangReviewPostingResult[]> {
    try {
      this.logger.log(`벌크 쿠팡 리뷰 포스팅 시작: ${request.items.length}개 항목`)

      const results: CoupangReviewPostingResult[] = []

      for (const item of request.items) {
        try {
          const result = await this.startSinglePosting({
            coupangUrl: item.coupangUrl,
            blogType: item.blogType,
            accountId: item.accountId,
          })
          results.push(result)
        } catch (error) {
          this.logger.error(`개별 작업 실패: ${item.coupangUrl}`, error)
          results.push({
            jobId: '',
            status: 'failed',
            message: `작업 실패: ${error.message}`,
          })
        }
      }

      return results
    } catch (error) {
      this.logger.error('벌크 쿠팡 리뷰 포스팅 시작 실패:', error)
      throw new CoupangReviewPostingErrorClass({
        code: 'BULK_POSTING_START_FAILED',
        message: '벌크 쿠팡 리뷰 포스팅 작업 시작에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 요청 유효성 검증
   */
  private async validateRequest(request: CreateCoupangReviewPostingDto): Promise<void> {
    // 쿠팡 URL 유효성 검증
    if (!request.coupangUrl.includes('coupang.com')) {
      throw new Error('유효하지 않은 쿠팡 URL입니다.')
    }

    // 블로그 타입별 계정 검증
    switch (request.blogType) {
      case 'wordpress':
        if (request.accountId) {
          const account = await this.wordpressService.getAccounts()
          const targetAccount = account.find(acc => acc.id === request.accountId)
          if (!targetAccount) {
            throw new Error('워드프레스 계정을 찾을 수 없습니다.')
          }
        } else {
          const defaultAccount = await this.wordpressService.getDefaultAccount()
          if (!defaultAccount) {
            throw new Error('기본 워드프레스 계정이 설정되지 않았습니다.')
          }
        }
        break

      case 'tistory':
        if (request.accountId) {
          const account = await this.tistoryService.getAccounts()
          const targetAccount = account.find(acc => acc.id === request.accountId)
          if (!targetAccount) {
            throw new Error('티스토리 계정을 찾을 수 없습니다.')
          }
        } else {
          const defaultAccount = await this.tistoryService.getDefaultAccount()
          if (!defaultAccount) {
            throw new Error('기본 티스토리 계정이 설정되지 않았습니다.')
          }
        }
        break

      case 'google':
        // Google Blogger는 기존 시스템 사용
        break

      default:
        throw new Error('지원하지 않는 블로그 타입입니다.')
    }
  }

  /**
   * 워크플로우 실행
   */
  private async executeWorkflow(jobId: string, request: CreateCoupangReviewPostingDto): Promise<void> {
    // try {
    //   // Job 상태를 processing으로 변경
    //   await this.jobService.updateJobStatus(jobId, 'processing')
    //
    //   // 1. 컨텐츠 수집
    //   const productData = await this.collectContent(request.coupangUrl)
    //
    //   // 2. 블로그 내용 생성
    //   const generatedContent = await this.generateContent(productData)
    //
    //   // 3. 발행
    //   const postResult = await this.publishContent(request, generatedContent, productData.images)
    //
    //   // 4. Job 완료
    //   await this.jobService.updateJobStatus(jobId, 'completed')
    //
    //   this.logger.log(`쿠팡 리뷰 포스팅 완료 (Job ID: ${jobId}): ${postResult.url}`)
    // } catch (error) {
    //   this.logger.error(`워크플로우 실행 실패 (Job ID: ${jobId}):`, error)
    //   await this.jobService.updateJobStatus(jobId, 'failed')
    //   throw error
    // }
  }

  /**
   * 컨텐츠 수집
   */
  private async collectContent(coupangUrl: string): Promise<CoupangProductData> {
    try {
      // 1. 쿠팡 상품 정보 크롤링
      const crawledData = await this.coupangCrawler.crawlProductInfo(coupangUrl)

      // 2. 쿠팡 어필리에이트 링크 생성
      const affiliateData = await this.coupangPartners.createAffiliateLink(coupangUrl)

      return {
        title: crawledData.title,
        price: crawledData.price,
        originalUrl: coupangUrl,
        affiliateUrl: affiliateData.shortenUrl,
        images: crawledData.images,
        reviews: crawledData.reviews,
      }
    } catch (error) {
      this.logger.error('컨텐츠 수집 실패:', error)
      throw new CoupangReviewPostingErrorClass({
        code: 'CONTENT_COLLECTION_FAILED',
        message: '컨텐츠 수집에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 블로그 내용 생성
   */
  private async generateContent(productData: CoupangProductData): Promise<GeneratedContent> {
    try {
      // TODO 구현하기
      // // 리뷰 기반으로 내용 생성
      // const prompt = this.buildContentPrompt(productData)
      // const generatedText = await this.contentGenerate.generateContent(prompt)
      //
      // // AI로 태그 생성
      // const tagPrompt = `다음 상품에 대한 블로그 태그 10개를 생성해주세요: ${productData.title}`
      // const generatedTags = await this.contentGenerate.generateContent(tagPrompt)
      //
      // // 태그 파싱 (쉼표로 구분된 태그들을 배열로 변환)
      // const tags = generatedTags
      //   .split(',')
      //   .map(tag => tag.trim())
      //   .filter(tag => tag.length > 0)
      //   .slice(0, 10)

      return {
        title: `${productData.title} 리뷰 - 실제 사용자 후기 모음`,
        content: '',
        tags: [],
      }
    } catch (error) {
      this.logger.error('블로그 내용 생성 실패:', error)
      throw new CoupangReviewPostingErrorClass({
        code: 'CONTENT_GENERATION_FAILED',
        message: '블로그 내용 생성에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 내용 생성 프롬프트 빌드
   */
  private buildContentPrompt(productData: CoupangProductData): string {
    const positiveReviews = productData.reviews.positive
      .map(review => `[${review.rating}점] ${review.content}`)
      .join('\n')
    const negativeReviews = productData.reviews.negative
      .map(review => `[${review.rating}점] ${review.content}`)
      .join('\n')

    return `
다음 쿠팡 상품에 대한 블로그 포스트를 작성해주세요.

상품 정보:
- 제목: ${productData.title}
- 가격: ${productData.price.toLocaleString()}원
- 쿠팡 링크: ${productData.affiliateUrl}

좋은 리뷰:
${positiveReviews}

나쁜 리뷰:
${negativeReviews}

요구사항:
1. 실제 사용자 리뷰를 기반으로 한 솔직한 리뷰 포스트
2. 장점과 단점을 균형있게 다룸
3. 구매 고려사항 포함
4. 다음 문구를 마지막에 포함: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
5. 자연스러운 블로그 톤으로 작성
6. HTML 태그 사용 가능

포스트를 작성해주세요.
`
  }

  /**
   * 컨텐츠 발행
   */
  private async publishContent(
    request: CreateCoupangReviewPostingDto,
    content: GeneratedContent,
    images: string[],
  ): Promise<{ url: string }> {
    try {
      switch (request.blogType) {
        case 'wordpress':
          return await this.publishToWordPress(request, content, images)

        case 'tistory':
          return await this.publishToTistory(request, content, images)

        case 'google':
          return await this.publishToGoogleBlogger(request, content, images)

        default:
          throw new Error('지원하지 않는 블로그 타입입니다.')
      }
    } catch (error) {
      this.logger.error('컨텐츠 발행 실패:', error)
      throw new CoupangReviewPostingErrorClass({
        code: 'CONTENT_PUBLISH_FAILED',
        message: '컨텐츠 발행에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스에 발행
   */
  private async publishToWordPress(
    request: CreateCoupangReviewPostingDto,
    content: GeneratedContent,
    images: string[],
  ): Promise<{ url: string }> {
    const accountId = request.accountId || (await this.wordpressService.getDefaultAccount())?.id
    if (!accountId) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    // 이미지 업로드
    const uploadedImages: string[] = []
    for (const imagePath of images.slice(0, 5)) {
      try {
        const imageUrl = await this.wordpressService.uploadImage(accountId, imagePath, `image_${Date.now()}.webp`)
        uploadedImages.push(imageUrl)
      } catch (error) {
        this.logger.warn('이미지 업로드 실패:', error)
      }
    }

    // 이미지를 컨텐츠에 삽입
    let finalContent = content.content
    for (let i = 0; i < uploadedImages.length; i++) {
      const imageHtml = `<img src="${uploadedImages[i]}" alt="상품 이미지 ${i + 1}" style="max-width: 100%; height: auto;" />`
      finalContent += `\n\n${imageHtml}`
    }

    // 포스트 발행
    const result = await this.wordpressService.publishPost(accountId, {
      title: content.title,
      content: finalContent,
      tags: content.tags,
    })

    return { url: result.url }
  }

  /**
   * 티스토리에 발행
   */
  private async publishToTistory(
    request: CreateCoupangReviewPostingDto,
    content: GeneratedContent,
    images: string[],
  ): Promise<{ url: string }> {
    const accountId = request.accountId || (await this.tistoryService.getDefaultAccount())?.id
    if (!accountId) {
      throw new Error('티스토리 계정을 찾을 수 없습니다.')
    }

    // 이미지 업로드
    const uploadedImages: string[] = []
    for (const imagePath of images.slice(0, 5)) {
      try {
        const imageUrl = await this.tistoryService.uploadImage(accountId, imagePath, `image_${Date.now()}.webp`)
        uploadedImages.push(imageUrl)
      } catch (error) {
        this.logger.warn('이미지 업로드 실패:', error)
      }
    }

    // 이미지를 컨텐츠에 삽입
    let finalContentHtml = content.content
    for (let i = 0; i < uploadedImages.length; i++) {
      const imageHtml = `<img src="${uploadedImages[i]}" alt="상품 이미지 ${i + 1}" style="max-width: 100%; height: auto;" />`
      finalContentHtml += `\n\n${imageHtml}`
    }

    // 포스트 발행
    const result = await this.tistoryService.publishPost(accountId, {
      url: null,
      title: content.title,
      contentHtml: finalContentHtml,
      keywords: content.tags,
    })

    return { url: result.url }
  }

  /**
   * Google Blogger에 발행 (기존 시스템 사용)
   */
  private async publishToGoogleBlogger(
    request: CreateCoupangReviewPostingDto,
    content: GeneratedContent,
    images: string[],
  ): Promise<{ url: string }> {
    // 기존 Google Blogger 시스템 사용
    // TODO: Google Blogger 연동 구현
    throw new Error('Google Blogger 발행은 아직 구현되지 않았습니다.')
  }
}
