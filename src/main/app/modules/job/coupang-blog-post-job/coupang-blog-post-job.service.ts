import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CoupangBlogPostJobResponse, CoupangBlogPostJobStatus } from './coupang-blog-post-job.types'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { CreateCoupangBlogPostJobDto, UpdateCoupangBlogPostJobDto } from './dto'
import { CoupangProductData } from '@main/app/modules/coupang-review-posting/coupang-review-posting.types'
import { CoupangCrawlerService } from '../../coupang-crawler/coupang-crawler.service'
import { CoupangPartnersService } from '../../coupang-partners/coupang-partners.service'
import { AIFactory } from '../../ai/ai.factory'

@Injectable()
export class CoupangBlogPostJobService {
  private readonly logger = new Logger(CoupangBlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupangCrawler: CoupangCrawlerService,
    private readonly coupangPartners: CoupangPartnersService,
    private readonly aiFactory: AIFactory,
  ) {}

  public async collectContent(coupangUrl: string): Promise<CoupangProductData> {
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
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  /**
   * 컨텐츠 생성
   */
  public async generateContent(productData: CoupangProductData): Promise<string> {
    try {
      const aiService = await this.aiFactory.getAIService()
      await aiService.initialize()

      const title = `${productData.title} 리뷰`
      const description = `
        쿠팡 상품 리뷰 블로그 포스트를 작성해주세요.
        
        상품 정보:
        - 제목: ${productData.title}
        - 가격: ${productData.price}
        - 원본 URL: ${productData.originalUrl}
        - 어필리에이트 URL: ${productData.affiliateUrl}
        
        요구사항:
        1. 상품의 장점과 특징을 중심으로 작성
        2. 실제 사용 경험을 바탕으로 한 리뷰 형식
        3. 구매 링크를 포함
        4. HTML 형식으로 작성
      `

      // 블로그 아웃라인 생성
      const blogOutline = await aiService.generateBlogOutline(title, description)

      // 블로그 포스트 생성
      const blogPost = await aiService.generateBlogPost(blogOutline)

      // HTML 조합
      const generatedContent = blogPost.sections.map(section => section.html).join('\n')
      return generatedContent
    } catch (error) {
      this.logger.error('컨텐츠 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  /**
   * 쿠팡 블로그 포스트 발행
   */
  public async publishCoupangBlogPost(
    coupangBlogJob: any,
    content: string,
    images: string[],
  ): Promise<{ url: string }> {
    // 우선순위: 구글 블로그 → 워드프레스 → 티스토리
    switch (
      coupangBlogJob.bloggerAccountId
        ? 'blogger'
        : coupangBlogJob.wordpressAccountId
          ? 'wordpress'
          : coupangBlogJob.tistoryAccountId
            ? 'tistory'
            : 'none'
    ) {
      case 'blogger':
        return await this.publishToBlogger(coupangBlogJob, content, images)
      case 'wordpress':
        return await this.publishToWordPress(coupangBlogJob, content, images)
      case 'tistory':
        return await this.publishToTistory(coupangBlogJob, content, images)
      default:
        throw new Error('No connected account found')
    }
  }

  private async publishToBlogger(coupangBlogJob: any, content: string, images: string[]): Promise<{ url: string }> {
    // 구글 블로거 발행 로직
    this.logger.log(`Publishing Coupang review to Blogger: ${coupangBlogJob.title}`)
    // 실제 발행 로직 구현 필요
    return { url: 'https://blogger.com/post/123' }
  }

  private async publishToWordPress(coupangBlogJob: any, content: string, images: string[]): Promise<{ url: string }> {
    // 워드프레스 발행 로직
    this.logger.log(`Publishing Coupang review to WordPress: ${coupangBlogJob.title}`)
    // 실제 발행 로직 구현 필요
    return { url: 'https://wordpress.com/post/123' }
  }

  private async publishToTistory(coupangBlogJob: any, content: string, images: string[]): Promise<{ url: string }> {
    // 티스토리 발행 로직
    this.logger.log(`Publishing Coupang review to Tistory: ${coupangBlogJob.title}`)
    // 실제 발행 로직 구현 필요
    return { url: 'https://tistory.com/post/123' }
  }

  /**
   * 쿠팡 블로그 포스트 작업 처리
   */
  public async processCoupangPostJob(jobId: string): Promise<{ resultUrl?: string; resultMsg: string }> {
    try {
      const coupangBlogJob = await this.prisma.coupangBlogJob.findUnique({
        where: { jobId },
        include: {
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      if (!coupangBlogJob) {
        throw new Error('CoupangBlogJob not found')
      }

      // 1. 컨텐츠 수집
      const productData = await this.collectContent(coupangBlogJob.coupangUrl)

      // 2. 블로그 내용 생성
      const generatedContent = await this.generateContent(productData)

      // 3. 발행
      const postResult = await this.publishCoupangBlogPost(coupangBlogJob, generatedContent, productData.images)

      return {
        resultUrl: postResult.url,
        resultMsg: '쿠팡 리뷰 포스트가 성공적으로 발행되었습니다.',
      }
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 처리 실패:', error)
      throw error
    }
  }

  /**
   * CoupangBlogPostJob 생성
   */
  async createCoupangBlogPostJob(jobData: CreateCoupangBlogPostJobDto): Promise<CoupangBlogPostJobResponse> {
    try {
      // Job 생성
      const job = await this.prisma.job.create({
        data: {
          targetType: 'coupang-review-posting',
          subject: jobData.subject,
          desc: jobData.desc,
          status: 'pending',
          priority: jobData.priority || 1,
          scheduledAt: jobData.scheduledAt ? new Date(jobData.scheduledAt) : new Date(),
        },
      })

      // CoupangBlogJob 생성
      const coupangBlogJob = await this.prisma.coupangBlogJob.create({
        data: {
          coupangUrl: jobData.coupangUrl,
          coupangAffiliateLink: jobData.coupangAffiliateLink,
          title: jobData.title,
          content: jobData.content,
          labels: jobData.labels,
          tags: jobData.tags,
          category: jobData.category,
          status: CoupangBlogPostJobStatus.DRAFT,
          jobId: job.id,
          bloggerAccountId: jobData.bloggerAccountId,
          wordpressAccountId: jobData.wordpressAccountId,
          tistoryAccountId: jobData.tistoryAccountId,
        },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 조회
   */
  async getCoupangBlogPostJob(jobId: string): Promise<CoupangBlogPostJobResponse | null> {
    try {
      const coupangBlogJob = await this.prisma.coupangBlogJob.findUnique({
        where: { jobId },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      if (!coupangBlogJob) {
        return null
      }

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 목록 조회
   */
  async getCoupangBlogPostJobs(status?: CoupangBlogPostJobStatus): Promise<CoupangBlogPostJobResponse[]> {
    try {
      const where: any = {}
      if (status) {
        where.status = status
      }

      const coupangBlogJobs = await this.prisma.coupangBlogJob.findMany({
        where,
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return coupangBlogJobs.map(coupangBlogJob => this.mapToResponseDto(coupangBlogJob))
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 업데이트
   */
  async updateCoupangBlogPostJob(
    jobId: string,
    updateData: UpdateCoupangBlogPostJobDto,
  ): Promise<CoupangBlogPostJobResponse> {
    try {
      const coupangBlogJob = await this.prisma.coupangBlogJob.update({
        where: { jobId },
        data: {
          title: updateData.title,
          content: updateData.content,
          labels: updateData.labels,
          tags: updateData.tags,
          category: updateData.category,
          status: updateData.status,
          resultUrl: updateData.resultUrl,
          coupangAffiliateLink: updateData.coupangAffiliateLink,
          publishedAt: updateData.status === CoupangBlogPostJobStatus.PUBLISHED ? new Date() : undefined,
        },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 삭제
   */
  async deleteCoupangBlogPostJob(jobId: string): Promise<void> {
    try {
      await this.prisma.coupangBlogJob.delete({
        where: { jobId },
      })
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_DELETE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 상태 업데이트
   */
  async updateCoupangBlogPostJobStatus(
    jobId: string,
    status: CoupangBlogPostJobStatus,
  ): Promise<CoupangBlogPostJobResponse> {
    try {
      const updateData: any = { status }

      if (status === CoupangBlogPostJobStatus.PUBLISHED) {
        updateData.publishedAt = new Date()
      }

      const coupangBlogJob = await this.prisma.coupangBlogJob.update({
        where: { jobId },
        data: updateData,
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 상태 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * 응답 DTO로 매핑
   */
  private mapToResponseDto(coupangBlogJob: any): CoupangBlogPostJobResponse {
    return {
      id: coupangBlogJob.id,
      coupangUrl: coupangBlogJob.coupangUrl,
      coupangAffiliateLink: coupangBlogJob.coupangAffiliateLink,
      title: coupangBlogJob.title,
      content: coupangBlogJob.content,
      labels: coupangBlogJob.labels,
      tags: coupangBlogJob.tags,
      category: coupangBlogJob.category,
      resultUrl: coupangBlogJob.resultUrl,
      status: coupangBlogJob.status as CoupangBlogPostJobStatus,
      publishedAt: coupangBlogJob.publishedAt?.toISOString(),
      createdAt: coupangBlogJob.createdAt.toISOString(),
      updatedAt: coupangBlogJob.updatedAt.toISOString(),
      jobId: coupangBlogJob.jobId,
      bloggerAccountId: coupangBlogJob.bloggerAccountId,
      wordpressAccountId: coupangBlogJob.wordpressAccountId,
      tistoryAccountId: coupangBlogJob.tistoryAccountId,
    }
  }
}
