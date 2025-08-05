import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobProcessor, JobStatus, JobTargetType } from './job.types'
import { TopicJobProcessor } from '@main/app/modules/topic/topic-job.processor'
import { Job } from '@prisma/client'
import { BlogPostJobProcessor } from '@main/app/modules/job/blog-post-job/blog-post-job.processor'
import { CoupangBlogPostJobProcessor } from '@main/app/modules/job/coupang-blog-post-job/coupang-blog-post-job.processor'
import { JobLogsService } from '@main/app/modules/job/job-logs/job-logs.service'

@Injectable()
export class JobQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobQueueProcessor.name)
  private processors: Partial<Record<JobTargetType, JobProcessor>>

  constructor(
    private readonly prisma: PrismaService,
    private readonly blogPostJobProcessor: BlogPostJobProcessor,
    private readonly coupangBlogPostJobProcessor: CoupangBlogPostJobProcessor,
    private readonly topicJobProcessor: TopicJobProcessor,
    private readonly jobLogsService: JobLogsService,
  ) {}

  async onModuleInit() {
    this.processors = {
      [JobTargetType.GENERATE_TOPIC]: this.topicJobProcessor,
      [JobTargetType.BLOG_INFO_POSTING]: this.blogPostJobProcessor,
      [JobTargetType.COUPANG_REVIEW_POSTING]: this.coupangBlogPostJobProcessor,
    }
    // 1. 시작 직후 processing 상태인 것들을 error 처리 (중간에 강제종료된 경우)
    await this.removeUnprocessedJobs()
  }

  private async removeUnprocessedJobs() {
    try {
      const processingJobs = await this.prisma.job.findMany({
        where: { status: JobStatus.PROCESSING },
      })
      for (const job of processingJobs) {
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            errorMsg: '시스템 재시작으로 인한 작업 중단',
            completedAt: new Date(),
          },
        })
        await this.jobLogsService.log(job.id, '시스템 재시작으로 인한 작업 중단', 'error')
      }
      this.logger.log(`처리 중이던 ${processingJobs.length}개 작업을 실패 처리했습니다.`)
    } catch (error) {
      this.logger.error('처리 중이던 작업 정리 실패:', error)
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processNextJobs() {
    // 현재 processing 중인 job이 있는지 확인
    const processingCount = await this.prisma.job.count({
      where: { status: JobStatus.PROCESSING },
    })

    if (processingCount === 0) {
      // processing 중인 job이 없을 때만 pending job을 하나만 가져와서 처리
      const requestJobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.REQUEST,
          scheduledAt: { lte: new Date() },
        },
        orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
        take: 1, // 한 번에 하나만 처리
      })

      for (const job of requestJobs) {
        await this.processJob(job)
      }
    }
  }

  public async processJob(job: Job) {
    const processor = this.processors[job.targetType as JobTargetType]
    if (!processor || !processor.canProcess(job)) {
      this.logger.error(`No valid processor for job type ${job.targetType}`)
      await this.markJobAsFailed(job.id, `No valid processor for job type ${job.targetType}`)
      return
    }

    try {
      const updateResult = await this.prisma.job.updateMany({
        where: {
          id: job.id,
          status: JobStatus.REQUEST, // 이 조건이 중복 처리를 방지합니다
        },
        data: {
          status: JobStatus.PROCESSING,
          startedAt: new Date(),
        },
      })

      // 다른 프로세스가 이미 처리 중인 경우 건너뛰기
      if (updateResult.count === 0) {
        this.logger.debug(`Job ${job.id} is already being processed by another instance`)
        return
      }

      this.logger.debug(`Starting job ${job.id} (${job.targetType})`)

      const result = await processor.process(job.id)

      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          ...(result && {
            resultMsg: result.resultMsg,
          }),
        },
      })

      this.logger.debug(`Completed job ${job.id}`)
    } catch (error) {
      await this.jobLogsService.log(job.id, error.message, 'error')
      this.logger.error(error.message, error.stack)
      await this.markJobAsFailed(job.id, error.message)
    }
  }

  private async markJobAsFailed(jobId: string, errorMsg: string) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        errorMsg,
        completedAt: new Date(),
      },
    })
  }
}
