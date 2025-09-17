import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { CoupangBlogJob } from '@prisma/client'
import { CreateCoupangBlogPostJobDto } from './dto/create-coupang-blog-post-job.dto'
import { UpdateCoupangBlogPostJobDto } from './dto/update-coupang-blog-post-job.dto'
import { CoupangBlogPostJobResponse, CoupangBlogPostJobStatus } from './coupang-blog-post-job.types'
import { JobStatus, JobTargetType } from '../job.types'

@Injectable()
export class CoupangBlogPostJobCrudService {
  private readonly logger = new Logger(CoupangBlogPostJobCrudService.name)

  constructor(private readonly prisma: PrismaService) {}

  private _normalizeCoupangUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim()
    if (!trimmed) {
      throw new CustomHttpException(ErrorCode.INVALID_INPUT, { message: '쿠팡 URL이 비어있습니다.' })
    }

    let url: URL
    try {
      const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      url = new URL(withScheme)
    } catch {
      throw new CustomHttpException(ErrorCode.INVALID_INPUT, { message: `유효하지 않은 URL입니다: ${rawUrl}` })
    }

    const hostname = url.hostname.toLowerCase()
    switch (hostname) {
      case 'www.coupang.com':
      case 'coupang.com':
      case 'link.coupang.com':
        break
      default:
        throw new CustomHttpException(ErrorCode.INVALID_INPUT, { message: `쿠팡 도메인이 아닙니다: ${hostname}` })
    }

    let productId = ''
    const pathMatch = url.pathname.match(/\/vp\/products\/(\d+)/)
    if (pathMatch && pathMatch[1]) {
      productId = pathMatch[1]
    }
    if (!productId) {
      const pageKey = url.searchParams.get('pageKey')
      if (pageKey && /^\d+$/.test(pageKey)) {
        productId = pageKey
      }
    }

    const itemId = url.searchParams.get('itemId') || ''
    const vendorItemId = url.searchParams.get('vendorItemId') || ''

    if (!/^\d+$/.test(productId) || !/^\d+$/.test(itemId) || !/^\d+$/.test(vendorItemId)) {
      throw new CustomHttpException(ErrorCode.INVALID_INPUT, {
        message: `쿠팡 URL 파라미터가 유효하지 않습니다 (productId/itemId/vendorItemId)`,
      })
    }

    return `https://www.coupang.com/vp/products/${productId}?itemId=${itemId}&vendorItemId=${vendorItemId}`
  }

  public async createCoupangBlogPostJob(jobData: CreateCoupangBlogPostJobDto): Promise<CoupangBlogPostJobResponse> {
    try {
      const normalizedUrls = Array.from(new Set((jobData.coupangUrls || []).map(u => this._normalizeCoupangUrl(u))))
      const job = await this.prisma.job.create({
        data: {
          targetType: JobTargetType.COUPANG_REVIEW_POSTING,
          subject: jobData.subject,
          desc: jobData.desc,
          status: jobData.immediateRequest ? JobStatus.REQUEST : JobStatus.PENDING,
          priority: jobData.priority || 1,
          scheduledAt: jobData.scheduledAt ? new Date(jobData.scheduledAt) : new Date(),
        },
      })

      const coupangBlogJob = await this.prisma.coupangBlogJob.create({
        data: {
          coupangUrls: normalizedUrls,
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

      return this._mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  public async getCoupangBlogPostJob(jobId: string): Promise<CoupangBlogPostJobResponse | null> {
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

      if (!coupangBlogJob) return null
      return this._mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  public async getCoupangBlogPostJobs(status?: CoupangBlogPostJobStatus): Promise<CoupangBlogPostJobResponse[]> {
    try {
      const where: any = {}
      if (status) where.status = status

      const coupangBlogJobs = await this.prisma.coupangBlogJob.findMany({
        where,
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      return coupangBlogJobs.map(coupangBlogJob => this._mapToResponseDto(coupangBlogJob))
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  public async updateCoupangBlogPostJob(
    jobId: string,
    updateData: UpdateCoupangBlogPostJobDto,
  ): Promise<CoupangBlogPostJobResponse> {
    try {
      let publishedAt: Date | null = null
      if (updateData.publishedAt) {
        publishedAt = new Date(updateData.publishedAt)
      } else if (updateData.status === CoupangBlogPostJobStatus.PUBLISHED) {
        publishedAt = new Date()
      }

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
          publishedAt,
        },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this._mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  public async deleteCoupangBlogPostJob(jobId: string): Promise<void> {
    try {
      await this.prisma.coupangBlogJob.delete({ where: { jobId } })
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_DELETE_FAILED)
    }
  }

  public async updateCoupangBlogPostJobStatus(
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

      return this._mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 상태 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  private _mapToResponseDto(coupangBlogJob: CoupangBlogJob): CoupangBlogPostJobResponse {
    return {
      id: coupangBlogJob.id,
      coupangUrls: coupangBlogJob.coupangUrls as string[],
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
