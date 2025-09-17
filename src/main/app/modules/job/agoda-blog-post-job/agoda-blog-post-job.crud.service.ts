import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { AgodaBlogJob } from '@prisma/client'
import { CreateAgodaBlogPostJobDto, UpdateAgodaBlogPostJobDto } from '@main/app/modules/job/agoda-blog-post-job/dto'
import { AgodaBlogPostJobResponse, AgodaBlogPostJobStatus } from './agoda-blog-post-job.types'
import { JobStatus, JobTargetType } from '../job.types'

@Injectable()
export class AgodaBlogPostJobCrudService {
  private readonly logger = new Logger(AgodaBlogPostJobCrudService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * AgodaBlogPostJob 생성
   */
  public async createAgodaBlogPostJob(jobData: CreateAgodaBlogPostJobDto): Promise<AgodaBlogPostJobResponse> {
    try {
      const normalizedUrls = Array.from(new Set((jobData.agodaUrls || []).map(u => this._normalizeAgodaUrl(u))))
      const job = await this.prisma.job.create({
        data: {
          targetType: JobTargetType.AGODA_POSTING,
          subject: jobData.subject,
          desc: jobData.desc,
          status: jobData.immediateRequest ? JobStatus.REQUEST : JobStatus.PENDING,
          priority: jobData.priority || 1,
          scheduledAt: jobData.scheduledAt ? new Date(jobData.scheduledAt) : new Date(),
        },
      })

      const agodaBlogJob = await this.prisma.agodaBlogJob.create({
        data: {
          agodaUrls: normalizedUrls,
          title: jobData.title,
          content: jobData.content,
          labels: jobData.labels,
          tags: jobData.tags,
          category: jobData.category,
          status: AgodaBlogPostJobStatus.DRAFT,
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

      return this._mapToResponseDto(agodaBlogJob)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 조회
   */
  public async getAgodaBlogPostJob(jobId: string): Promise<AgodaBlogPostJobResponse | null> {
    try {
      const agodaBlogJob = await this.prisma.agodaBlogJob.findUnique({
        where: { jobId },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      if (!agodaBlogJob) {
        return null
      }

      return this._mapToResponseDto(agodaBlogJob)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 목록 조회
   */
  public async getAgodaBlogPostJobs(status?: AgodaBlogPostJobStatus): Promise<AgodaBlogPostJobResponse[]> {
    try {
      const where: any = {}
      if (status) {
        where.status = status
      }

      const agodaBlogJobs = await this.prisma.agodaBlogJob.findMany({
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

      return agodaBlogJobs.map(agodaBlogJob => this._mapToResponseDto(agodaBlogJob))
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 업데이트
   */
  public async updateAgodaBlogPostJob(
    jobId: string,
    updateData: UpdateAgodaBlogPostJobDto,
  ): Promise<AgodaBlogPostJobResponse> {
    try {
      let publishedAt: Date | null = null
      if (updateData.publishedAt) {
        publishedAt = new Date(updateData.publishedAt)
      } else if (updateData.status === AgodaBlogPostJobStatus.PUBLISHED) {
        publishedAt = new Date()
      }

      const agodaBlogJob = await this.prisma.agodaBlogJob.update({
        where: { jobId },
        data: {
          title: updateData.title,
          content: updateData.content,
          labels: updateData.labels,
          tags: updateData.tags,
          category: updateData.category,
          status: updateData.status,
          resultUrl: updateData.resultUrl,
          publishedAt,
        },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this._mapToResponseDto(agodaBlogJob)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 삭제
   */
  public async deleteAgodaBlogPostJob(jobId: string): Promise<void> {
    try {
      await this.prisma.agodaBlogJob.delete({
        where: { jobId },
      })
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_DELETE_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 상태 업데이트
   */
  public async updateAgodaBlogPostJobStatus(
    jobId: string,
    status: AgodaBlogPostJobStatus,
  ): Promise<AgodaBlogPostJobResponse> {
    try {
      const updateData: any = { status }
      if (status === AgodaBlogPostJobStatus.PUBLISHED) {
        updateData.publishedAt = new Date()
      }

      const agodaBlogJob = await this.prisma.agodaBlogJob.update({
        where: { jobId },
        data: updateData,
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this._mapToResponseDto(agodaBlogJob)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 상태 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * 응답 DTO로 매핑
   */
  private _mapToResponseDto(agodaBlogJob: AgodaBlogJob): AgodaBlogPostJobResponse {
    return {
      id: agodaBlogJob.id,
      agodaUrls: agodaBlogJob.agodaUrls as string[],
      title: agodaBlogJob.title,
      content: agodaBlogJob.content,
      labels: agodaBlogJob.labels,
      tags: agodaBlogJob.tags,
      category: agodaBlogJob.category,
      resultUrl: agodaBlogJob.resultUrl,
      status: agodaBlogJob.status as AgodaBlogPostJobStatus,
      publishedAt: agodaBlogJob.publishedAt?.toISOString(),
      createdAt: agodaBlogJob.createdAt.toISOString(),
      updatedAt: agodaBlogJob.updatedAt.toISOString(),
      jobId: agodaBlogJob.jobId,
      bloggerAccountId: agodaBlogJob.bloggerAccountId,
      wordpressAccountId: agodaBlogJob.wordpressAccountId,
      tistoryAccountId: agodaBlogJob.tistoryAccountId,
    }
  }

  /**
   * 아고다 URL 정규화: 불필요한 파라미터 제거 및 도메인/스킴 표준화
   */
  private _normalizeAgodaUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim()
    if (!trimmed) {
      throw new CustomHttpException(ErrorCode.INVALID_INPUT, { message: '아고다 URL이 비어있습니다.' })
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
      case 'www.agoda.com':
      case 'agoda.com':
      case 'm.agoda.com':
        break
      default:
        throw new CustomHttpException(ErrorCode.INVALID_INPUT, { message: `아고다 도메인이 아닙니다: ${hostname}` })
    }

    // 스킴/호스트 표준화 및 해시 제거
    const protocol = 'https:'
    const hostnameCanonical = 'www.agoda.com'
    url.hash = ''

    // 중복 슬래시 제거 및 트레일링 슬래시 정규화 (경로 보존)
    let pathname = url.pathname.replace(/\/+/, '/').replace(/\/+$/, '')
    if (pathname.length === 0) pathname = '/'

    // 필수 파라미터만 유지
    const allowedParams = ['checkIn', 'los', 'adults', 'rooms']
    const preserved = new URL(`${protocol}//${hostnameCanonical}${pathname}`)
    for (const key of allowedParams) {
      const value = url.searchParams.get(key)
      if (value !== null && value !== '') {
        preserved.searchParams.set(key, value)
      }
    }

    return preserved.toString()
  }
}
