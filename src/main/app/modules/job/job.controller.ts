import { Body, Controller, Delete, Get, Param, Post, Query, Patch, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { JobQueueProcessor } from './job-queue.processor'
import { Prisma } from '@prisma/client'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobStatus, JobTargetType } from './job.types'
import { UpdateJobDto } from './dto'

@Controller('jobs')
export class JobController {
  private readonly logger = new Logger(JobController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobProcessor: JobQueueProcessor,
  ) {}

  @Get(':id')
  async getJob(@Param('id') jobId: string) {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: {
          logs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
          },
          blogJob: true,
          topicJob: true,
          coupangBlogJob: {
            include: {
              tistoryAccount: true,
              wordpressAccount: true,
              bloggerAccount: true,
            },
          },
        },
      })

      if (!job) {
        throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
      }

      return job
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @Get()
  async getJobs(
    @Query('status') status?: JobStatus,
    @Query('targetType') targetType?: JobTargetType,
    @Query('search') search?: string,
    @Query('orderBy') orderBy: string = 'updatedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    try {
      const where: Prisma.JobWhereInput = {}

      // 상태 필터
      if (status) {
        where.status = status
      }

      // 타입 필터
      if (targetType) {
        where.targetType = targetType
      }

      // 검색 필터
      if (search) {
        where.OR = [
          { subject: { contains: search } },
          { desc: { contains: search } },
          { resultMsg: { contains: search } },
        ]
      }

      const jobs = await this.prisma.job.findMany({
        where,
        orderBy: {
          [orderBy]: order,
        },
        include: {
          logs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          blogJob: true,
          topicJob: true,
          coupangBlogJob: {
            include: {
              tistoryAccount: true,
              wordpressAccount: true,
              bloggerAccount: true,
            },
          },
        },
      })

      return jobs
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  // 유형별 전용 엔드포인트들
  @Get('blog')
  async getBlogJobs(
    @Query('status') status?: JobStatus,
    @Query('type') type?: JobTargetType,
    @Query('search') search?: string,
    @Query('orderBy') orderBy: string = 'updatedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    try {
      const where: Prisma.JobWhereInput = {
        targetType: 'blog-info-posting', // 블로그 작업만 필터링
      }

      // 상태 필터
      if (status) {
        where.status = status
      }

      // 검색 필터
      if (search) {
        where.OR = [
          { subject: { contains: search } },
          { desc: { contains: search } },
          { resultMsg: { contains: search } },
        ]
      }

      const jobs = await this.prisma.job.findMany({
        where,
        orderBy: {
          [orderBy]: order,
        },
        include: {
          logs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          blogJob: true,
        },
      })

      return jobs
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @Get('coupang')
  async getCoupangJobs(
    @Query('status') status?: JobStatus,
    @Query('type') type?: JobTargetType,
    @Query('search') search?: string,
    @Query('orderBy') orderBy: string = 'updatedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    try {
      const where: Prisma.JobWhereInput = {
        targetType: JobTargetType.COUPANG_REVIEW_POSTING, // 쿠팡 작업만 필터링
      }

      // 상태 필터
      if (status) {
        where.status = status
      }

      // 검색 필터
      if (search) {
        where.OR = [
          { subject: { contains: search } },
          { desc: { contains: search } },
          { resultMsg: { contains: search } },
        ]
      }

      const jobs = await this.prisma.job.findMany({
        where,
        orderBy: {
          [orderBy]: order,
        },
        include: {
          logs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          coupangBlogJob: {
            include: {
              tistoryAccount: true,
              wordpressAccount: true,
              bloggerAccount: true,
            },
          },
        },
      })

      return jobs
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @Get('topic')
  async getTopicJobs(
    @Query('status') status?: JobStatus,
    @Query('type') type?: JobTargetType,
    @Query('search') search?: string,
    @Query('orderBy') orderBy: string = 'updatedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    try {
      const where: Prisma.JobWhereInput = {
        targetType: 'generate_topic', // 토픽 생성 작업만 필터링
      }

      // 상태 필터
      if (status) {
        where.status = status
      }

      // 검색 필터
      if (search) {
        where.OR = [
          { subject: { contains: search } },
          { desc: { contains: search } },
          { resultMsg: { contains: search } },
        ]
      }

      const jobs = await this.prisma.job.findMany({
        where,
        orderBy: {
          [orderBy]: order,
        },
        include: {
          logs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          topicJob: true,
        },
      })

      return jobs
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @Post('bulk/retry')
  async retryJobs(@Body() body: { jobIds: string[] }) {
    try {
      const { jobIds } = body

      if (!jobIds || jobIds.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
      }

      const jobs = await this.prisma.job.findMany({
        where: {
          id: { in: jobIds },
        },
      })

      if (jobs.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND)
      }

      // 실패한 작업만 필터링
      const failedJobs = jobs.filter(job => job.status === JobStatus.FAILED)
      const nonFailedJobs = jobs.filter(job => job.status !== JobStatus.FAILED)

      let successCount = 0
      let failedCount = 0
      const errors: string[] = []

      for (const job of failedJobs) {
        try {
          await this.prisma.job.update({
            where: { id: job.id },
            data: {
              status: JobStatus.REQUEST,
              resultMsg: null,
              errorMsg: null,
            },
          })

          // 작업 로그 추가
          await this.prisma.jobLog.create({
            data: {
              jobId: job.id,
              message: '작업이 재시도됩니다.',
            },
          })

          // 작업 큐에 다시 추가 (비동기로 처리)
          this.jobProcessor.processJob(job).catch(error => {
            this.logger.error(`Job ${job.id} 재시도 처리 중 오류:`, error)
          })
          successCount++
        } catch (error) {
          failedCount++
          errors.push(`작업 ${job.id}: ${error.message}`)
        }
      }

      // 실패하지 않은 작업이 있다면 메시지에 포함
      if (nonFailedJobs.length > 0) {
        errors.push(`실패하지 않은 작업 ${nonFailedJobs.length}개는 재시도에서 제외되었습니다.`)
      }

      return {
        success: true,
        message: `${successCount}개 작업이 재시도되었습니다.`,
        details: {
          successCount,
          failedCount,
          errors,
        },
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_BULK_RETRY_FAILED)
    }
  }

  @Post('bulk/delete')
  async deleteJobs(@Body() body: { jobIds: string[] }) {
    try {
      const { jobIds } = body

      if (!jobIds || jobIds.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
      }

      const jobs = await this.prisma.job.findMany({
        where: {
          id: { in: jobIds },
        },
      })

      if (jobs.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobIds })
      }

      // 처리 중인 작업 제외 및 삭제 가능한 작업 필터링
      const processingJobs = jobs.filter(job => job.status === JobStatus.PROCESSING)
      const deletableJobs = jobs.filter(job => job.status !== JobStatus.PROCESSING)

      let successCount = 0
      let failedCount = 0
      const errors: string[] = []

      for (const job of deletableJobs) {
        try {
          // 작업과 관련된 로그 삭제는 Prisma의 onDelete: Cascade로 자동 처리됨
          await this.prisma.job.delete({
            where: { id: job.id },
          })
          successCount++
        } catch (error) {
          failedCount++
          errors.push(`작업 ${job.id}: ${error.message}`)
        }
      }

      // 처리 중인 작업이 있다면 메시지에 포함
      if (processingJobs.length > 0) {
        errors.push(`처리 중인 작업 ${processingJobs.length}개는 삭제에서 제외되었습니다.`)
      }

      return {
        success: true,
        message: `${successCount}개 작업이 삭제되었습니다.`,
        details: {
          successCount,
          failedCount,
          errors,
        },
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_BULK_DELETE_FAILED)
    }
  }

  @Get(':id/logs')
  async getJobLogs(@Param('id') jobId: string) {
    try {
      const logs = await this.prisma.jobLog.findMany({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
      })

      return logs
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_LOG_FETCH_FAILED)
    }
  }

  @Get(':id/logs/latest')
  async getLatestJobLog(@Param('id') jobId: string) {
    try {
      const log = await this.prisma.jobLog.findFirst({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
      })

      return log
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_LOG_FETCH_FAILED)
    }
  }

  @Post(':id/retry')
  async retryJob(@Param('id') jobId: string) {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
      })

      if (!job) {
        throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
      }

      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.REQUEST,
          resultMsg: null,
          errorMsg: null,
        },
      })

      // 작업 로그 추가
      await this.prisma.jobLog.create({
        data: {
          jobId,
          message: '작업이 재시도됩니다.',
        },
      })

      // 작업 큐에 다시 추가 (비동기로 처리하여 즉시 응답)
      this.jobProcessor.processJob(job).catch(error => {
        this.logger.error(`Job ${jobId} 재시도 처리 중 오류:`, error)
      })

      return {
        success: true,
        message: '작업이 재시도됩니다.',
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_RETRY_FAILED)
    }
  }

  @Delete(':id')
  async deleteJob(@Param('id') jobId: string) {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
      })

      if (!job) {
        throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
      }

      if (job.status === JobStatus.PROCESSING) {
        throw new CustomHttpException(ErrorCode.JOB_DELETE_PROCESSING)
      }

      // 작업과 관련된 로그 삭제는 Prisma의 onDelete: Cascade로 자동 처리됨
      await this.prisma.job.delete({
        where: { id: jobId },
      })

      return {
        success: true,
        message: '작업이 삭제되었습니다.',
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_DELETE_FAILED)
    }
  }

  @Post(':id/request-to-pending')
  async requestToPending(@Param('id') jobId: string) {
    try {
      const job = await this.prisma.job.findUnique({ where: { id: jobId } })
      if (!job) {
        throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
      }
      if (job.status !== JobStatus.REQUEST) {
        throw new CustomHttpException(ErrorCode.JOB_STATUS_INVALID, { jobId, status: job.status })
      }
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.PENDING },
      })
      return { success: true, message: '상태가 등록대기(pending)로 변경되었습니다.' }
    } catch (error) {
      if (error instanceof CustomHttpException) throw error
      throw new CustomHttpException(ErrorCode.JOB_STATUS_CHANGE_FAILED)
    }
  }

  @Post(':id/pending-to-request')
  async pendingToRequest(@Param('id') jobId: string) {
    try {
      const job = await this.prisma.job.findUnique({ where: { id: jobId } })
      if (!job) {
        throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
      }
      if (job.status !== JobStatus.PENDING) {
        throw new CustomHttpException(ErrorCode.JOB_STATUS_INVALID, { jobId, status: job.status })
      }
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.REQUEST },
      })
      return { success: true, message: '상태가 등록요청(request)로 변경되었습니다.' }
    } catch (error) {
      if (error instanceof CustomHttpException) throw error
      throw new CustomHttpException(ErrorCode.JOB_STATUS_CHANGE_FAILED)
    }
  }

  @Get('scheduled')
  async getScheduledJobs() {
    try {
      const jobs = await this.prisma.job.findMany({
        where: {
          scheduledAt: { not: null },
        },
        orderBy: {
          scheduledAt: 'asc',
        },
        include: {
          logs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          blogJob: true,
          topicJob: true,
          coupangBlogJob: {
            include: {
              tistoryAccount: true,
              wordpressAccount: true,
              bloggerAccount: true,
            },
          },
        },
      })
      return jobs
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @Patch(':id')
  async updateJob(@Param('id') jobId: string, @Body() body: UpdateJobDto) {
    try {
      // 작업 존재 여부 확인
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
      })

      if (!job) {
        throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
      }

      const updateData: any = {}

      // scheduledAt 업데이트
      if (body.scheduledAt !== undefined) {
        updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
      }

      // status 업데이트
      if (body.status !== undefined) {
        updateData.status = body.status
      }

      // subject 업데이트
      if (body.subject !== undefined) {
        updateData.subject = body.subject
      }

      // desc 업데이트
      if (body.desc !== undefined) {
        updateData.desc = body.desc
      }

      // 업데이트할 데이터가 있는지 확인
      if (Object.keys(updateData).length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_UPDATE_NO_DATA)
      }

      await this.prisma.job.update({
        where: { id: jobId },
        data: updateData,
      })

      return {
        success: true,
        message: '작업이 성공적으로 업데이트되었습니다.',
        updatedFields: Object.keys(updateData),
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }
}
