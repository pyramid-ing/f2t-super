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
  async createAgodaBlogPostJob(jobData: CreateAgodaBlogPostJobDto): Promise<AgodaBlogPostJobResponse> {
    try {
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
          agodaUrls: jobData.agodaUrls,
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

      return this.mapToResponseDto(agodaBlogJob)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 조회
   */
  async getAgodaBlogPostJob(jobId: string): Promise<AgodaBlogPostJobResponse | null> {
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

      return this.mapToResponseDto(agodaBlogJob)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 목록 조회
   */
  async getAgodaBlogPostJobs(status?: AgodaBlogPostJobStatus): Promise<AgodaBlogPostJobResponse[]> {
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

      return agodaBlogJobs.map(agodaBlogJob => this.mapToResponseDto(agodaBlogJob))
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 업데이트
   */
  async updateAgodaBlogPostJob(
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

      return this.mapToResponseDto(agodaBlogJob)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 삭제
   */
  async deleteAgodaBlogPostJob(jobId: string): Promise<void> {
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
  async updateAgodaBlogPostJobStatus(jobId: string, status: AgodaBlogPostJobStatus): Promise<AgodaBlogPostJobResponse> {
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

      return this.mapToResponseDto(agodaBlogJob)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 상태 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * 응답 DTO로 매핑
   */
  private mapToResponseDto(agodaBlogJob: AgodaBlogJob): AgodaBlogPostJobResponse {
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
}
