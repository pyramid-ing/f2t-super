import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CoupangBlogPostJobResponse, CoupangBlogPostJobStatus } from './coupang-blog-post-job.types'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobProcessor, JobResult } from '../job.types'
import { Job } from '@prisma/client'
import { CreateCoupangBlogPostJobDto, UpdateCoupangBlogPostJobDto } from './dto'

@Injectable()
export class CoupangBlogPostJobService implements JobProcessor {
  private readonly logger = new Logger(CoupangBlogPostJobService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * JobProcessor 인터페이스 구현
   */
  async process(jobId: string): Promise<JobResult | void> {
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

      // 발행 로직 구현
      const result = await this.publishCoupangBlogPost(coupangBlogJob)

      return {
        resultMsg: '쿠팡 리뷰 포스트가 성공적으로 발행되었습니다.',
        resultUrl: result.url,
      }
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 처리 실패:', error)
      throw error
    }
  }

  canProcess(job: Job): boolean {
    return job.targetType === 'coupang-review-posting'
  }

  /**
   * 쿠팡 블로그 포스트 발행
   */
  private async publishCoupangBlogPost(coupangBlogJob: any): Promise<{ url: string }> {
    // 우선순위: 구글 블로그 → 워드프레스 → 티스토리
    if (coupangBlogJob.bloggerAccountId) {
      return await this.publishToBlogger(coupangBlogJob)
    } else if (coupangBlogJob.wordpressAccountId) {
      return await this.publishToWordPress(coupangBlogJob)
    } else if (coupangBlogJob.tistoryAccountId) {
      return await this.publishToTistory(coupangBlogJob)
    }

    throw new Error('No connected account found')
  }

  private async publishToBlogger(coupangBlogJob: any): Promise<{ url: string }> {
    // 구글 블로거 발행 로직
    this.logger.log(`Publishing Coupang review to Blogger: ${coupangBlogJob.title}`)
    // 실제 발행 로직 구현 필요
    return { url: 'https://blogger.com/post/123' }
  }

  private async publishToWordPress(coupangBlogJob: any): Promise<{ url: string }> {
    // 워드프레스 발행 로직
    this.logger.log(`Publishing Coupang review to WordPress: ${coupangBlogJob.title}`)
    // 실제 발행 로직 구현 필요
    return { url: 'https://wordpress.com/post/123' }
  }

  private async publishToTistory(coupangBlogJob: any): Promise<{ url: string }> {
    // 티스토리 발행 로직
    this.logger.log(`Publishing Coupang review to Tistory: ${coupangBlogJob.title}`)
    // 실제 발행 로직 구현 필요
    return { url: 'https://tistory.com/post/123' }
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
