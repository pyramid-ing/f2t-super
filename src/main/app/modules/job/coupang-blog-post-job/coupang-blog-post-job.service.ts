import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CoupangCrawlerService } from '@main/app/modules/coupang-crawler/coupang-crawler.service'
import { CoupangPartnersService } from '@main/app/modules/coupang-partners/coupang-partners.service'
import { AIFactory } from '@main/app/modules/ai/ai.factory'
import { TistoryService } from '@main/app/modules/tistory/tistory.service'
import { WordPressService } from '@main/app/modules/wordpress/wordpress.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobTargetType } from '@render/api'
import { CoupangBlogJob } from '@prisma/client'
import { CoupangBlogPostJobStatus, CoupangBlogPostJobResponse } from './coupang-blog-post-job.types'
import { CreateCoupangBlogPostJobDto } from './dto/create-coupang-blog-post-job.dto'
import { UpdateCoupangBlogPostJobDto } from './dto/update-coupang-blog-post-job.dto'
import { BlogOutline } from '@main/app/modules/ai/ai.interface'
import { CoupangProductData as CoupangCrawlerProductData } from '@main/app/modules/coupang-crawler/coupang-crawler.types'
import { CoupangAffiliateLink } from '@main/app/modules/coupang-partners/coupang-partners.types'

interface CoupangProductData {
  title: string
  price: string
  originalUrl: string
  affiliateUrl: string
  images: string[]
  reviews: any[]
}

interface BlogPostData {
  title: string
  content: string
  images: string[]
  affiliateUrl: string
}

@Injectable()
export class CoupangBlogPostJobService {
  private readonly logger = new Logger(CoupangBlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupangCrawler: CoupangCrawlerService,
    private readonly coupangPartners: CoupangPartnersService,
    private readonly aiFactory: AIFactory,
    private readonly tistoryService: TistoryService,
    private readonly wordpressService: WordPressService,
  ) {}

  /**
   * 1. 쿠팡 크롤링
   */
  private async crawlCoupangProduct(coupangUrl: string): Promise<CoupangProductData> {
    try {
      this.logger.log(`쿠팡 상품 크롤링 시작: ${coupangUrl}`)

      // 쿠팡 상품 정보 크롤링
      const crawledData: CoupangCrawlerProductData = await this.coupangCrawler.crawlProductInfo(coupangUrl)

      this.logger.log(`쿠팡 상품 크롤링 완료: ${crawledData.title}`)

      return {
        title: crawledData.title,
        price: crawledData.price.toString(),
        originalUrl: coupangUrl,
        affiliateUrl: '', // 2단계에서 설정
        images: crawledData.images,
        reviews: crawledData.reviews ? Object.values(crawledData.reviews).flat() : [],
      }
    } catch (error) {
      this.logger.error('쿠팡 크롤링 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '쿠팡 상품 정보 크롤링에 실패했습니다.',
      })
    }
  }

  /**
   * 2. 쿠팡 어필리에이트 생성
   */
  private async createAffiliateLink(coupangUrl: string): Promise<string> {
    try {
      this.logger.log(`쿠팡 어필리에이트 링크 생성 시작: ${coupangUrl}`)

      // 쿠팡 어필리에이트 링크 생성
      const affiliateData: CoupangAffiliateLink = await this.coupangPartners.createAffiliateLink(coupangUrl)

      this.logger.log(`쿠팡 어필리에이트 링크 생성 완료: ${affiliateData.shortenUrl}`)

      return affiliateData.shortenUrl
    } catch (error) {
      this.logger.error('쿠팡 어필리에이트 링크 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '쿠팡 어필리에이트 링크 생성에 실패했습니다.',
      })
    }
  }

  /**
   * 3. 이미지 업로드 (티스토리, 워드프레스)
   */
  private async uploadImages(
    images: string[],
    platform: 'tistory' | 'wordpress',
    accountId: number,
  ): Promise<string[]> {
    try {
      this.logger.log(`${platform} 이미지 업로드 시작: ${images.length}개`)

      const uploadedImages: string[] = []

      for (const imageUrl of images) {
        try {
          let uploadedUrl: string

          switch (platform) {
            case 'tistory':
              uploadedUrl = await this.tistoryService.uploadImage(accountId, imageUrl, 'product-image.jpg')
              break
            case 'wordpress':
              uploadedUrl = await this.wordpressService.uploadImage(accountId, imageUrl, 'product-image.jpg')
              break
            default:
              throw new Error(`지원하지 않는 플랫폼: ${platform}`)
          }

          uploadedImages.push(uploadedUrl)
          this.logger.log(`이미지 업로드 완료: ${imageUrl} → ${uploadedUrl}`)
        } catch (error) {
          this.logger.warn(`이미지 업로드 실패 (${imageUrl}):`, error)
          // 개별 이미지 업로드 실패 시 원본 URL 사용
          uploadedImages.push(imageUrl)
        }
      }

      this.logger.log(`${platform} 이미지 업로드 완료: ${uploadedImages.length}개`)
      return uploadedImages
    } catch (error) {
      this.logger.error(`${platform} 이미지 업로드 실패:`, error)
      // 이미지 업로드 실패 시 원본 이미지 사용
      return images
    }
  }

  /**
   * 4. 블로그 아웃라인 생성
   */
  private async generateBlogOutline(productData: CoupangProductData): Promise<BlogOutline> {
    try {
      this.logger.log('블로그 아웃라인 생성 시작')

      const aiService = await this.aiFactory.getAIService()
      await aiService.initialize()

      const title = `${productData.title} 리뷰`
      const description = `
        쿠팡 상품 리뷰 블로그 포스트 아웃라인을 작성해주세요.
        
        상품 정보:
        - 제목: ${productData.title}
        - 가격: ${productData.price}
        - 원본 URL: ${productData.originalUrl}
        - 어필리에이트 URL: ${productData.affiliateUrl}
        
        요구사항:
        1. 상품의 장점과 특징을 중심으로 구성
        2. 실제 사용 경험을 바탕으로 한 리뷰 형식
        3. 구매 링크를 포함
        4. 구조화된 아웃라인 제공
      `

      const blogOutline = await aiService.generateBlogOutline(title, description)

      this.logger.log('블로그 아웃라인 생성 완료')
      return blogOutline
    } catch (error) {
      this.logger.error('블로그 아웃라인 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '블로그 아웃라인 생성에 실패했습니다.',
      })
    }
  }

  /**
   * 5. 블로그 포스트 생성
   */
  private async generateBlogPost(blogOutline: BlogOutline, productData: CoupangProductData): Promise<BlogPostData> {
    try {
      this.logger.log('블로그 포스트 생성 시작')

      const aiService = await this.aiFactory.getAIService()
      await aiService.initialize()

      const blogPost = await aiService.generateBlogPost(blogOutline)
      const generatedContent = blogPost.sections.map(section => section.html).join('\n')

      this.logger.log('블로그 포스트 생성 완료')

      return {
        title: `${productData.title} 리뷰`,
        content: generatedContent,
        images: productData.images,
        affiliateUrl: productData.affiliateUrl,
      }
    } catch (error) {
      this.logger.error('블로그 포스트 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '블로그 포스트 생성에 실패했습니다.',
      })
    }
  }

  /**
   * 6. 지정된 블로그로 발행 (티스토리, 워드프레스)
   */
  private async publishToBlog(
    blogPostData: BlogPostData,
    platform: 'tistory' | 'wordpress',
    accountId: number,
    uploadedImages: string[],
  ): Promise<{ url: string }> {
    try {
      this.logger.log(`${platform} 블로그 발행 시작`)

      let publishedUrl: string

      switch (platform) {
        case 'tistory':
          const tistoryResult = await this.tistoryService.publishPost(accountId, {
            title: blogPostData.title,
            contentHtml: blogPostData.content,
            url: 'https://tistory.com',
            keywords: [blogPostData.title],
            imagePaths: uploadedImages,
          })
          publishedUrl = tistoryResult.url || 'https://tistory.com/draft'
          break
        case 'wordpress':
          const wordpressResult = await this.wordpressService.publishPost(accountId, {
            title: blogPostData.title,
            content: blogPostData.content,
            featuredImage: uploadedImages[0],
          })
          publishedUrl = wordpressResult.url
          break
        default:
          throw new Error(`지원하지 않는 플랫폼: ${platform}`)
      }

      this.logger.log(`${platform} 블로그 발행 완료: ${publishedUrl}`)
      return { url: publishedUrl }
    } catch (error) {
      this.logger.error(`${platform} 블로그 발행 실패:`, error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: `${platform} 블로그 발행에 실패했습니다.`,
      })
    }
  }

  /**
   * 쿠팡 블로그 포스트 작업 처리 (메인 프로세스)
   */
  public async processCoupangPostJob(jobId: string): Promise<{ resultUrl?: string; resultMsg: string }> {
    try {
      this.logger.log(`쿠팡 블로그 포스트 작업 시작: ${jobId}`)

      // 작업 정보 조회
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

      // 1. 쿠팡 크롤링
      const productData = await this.crawlCoupangProduct(coupangBlogJob.coupangUrl)

      // 2. 쿠팡 어필리에이트 생성
      const affiliateUrl = await this.createAffiliateLink(coupangBlogJob.coupangUrl)
      productData.affiliateUrl = affiliateUrl

      // 3. 이미지 업로드 (티스토리, 워드프레스)
      let uploadedImages: string[] = []
      let platform: 'tistory' | 'wordpress' | null = null
      let accountId: number | undefined = undefined

      if (coupangBlogJob.tistoryAccountId) {
        platform = 'tistory'
        accountId = coupangBlogJob.tistoryAccountId
        uploadedImages = await this.uploadImages(productData.images, 'tistory', accountId)
      } else if (coupangBlogJob.wordpressAccountId) {
        platform = 'wordpress'
        accountId = coupangBlogJob.wordpressAccountId
        uploadedImages = await this.uploadImages(productData.images, 'wordpress', accountId)
      } else {
        // 이미지 업로드할 플랫폼이 없는 경우 원본 이미지 사용
        uploadedImages = productData.images
      }

      // 4. 블로그 아웃라인 생성
      const blogOutline = await this.generateBlogOutline(productData)

      // 5. 블로그 포스트 생성
      const blogPostData = await this.generateBlogPost(blogOutline, productData)

      // 6. 지정된 블로그로 발행
      let publishedUrl: string
      if (platform && accountId) {
        const publishResult = await this.publishToBlog(blogPostData, platform, accountId, uploadedImages)
        publishedUrl = publishResult.url
      } else {
        // 발행할 플랫폼이 없는 경우 (구글 블로거 등)
        publishedUrl = 'https://example.com/draft'
      }

      this.logger.log(`쿠팡 블로그 포스트 작업 완료: ${jobId}`)

      return {
        resultUrl: publishedUrl,
        resultMsg: '쿠팡 리뷰 포스트가 성공적으로 발행되었습니다.',
      }
    } catch (error) {
      this.logger.error(`쿠팡 블로그 포스트 작업 실패: ${jobId}`, error)
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
          targetType: JobTargetType.COUPANG_REVIEW_POSTING,
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
  private mapToResponseDto(coupangBlogJob: CoupangBlogJob): CoupangBlogPostJobResponse {
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
