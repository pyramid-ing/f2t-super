import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobProcessor, JobStatus, JobTargetType } from './job.types'
import { Job } from '@prisma/client'
import { AgodaBlogPostJobProcessor } from '@main/app/modules/job/agoda-blog-post-job/agoda-blog-post-job.processor'
import { InfoBlogPostJobProcessor } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.processor'
import { CoupangBlogPostJobProcessor } from '@main/app/modules/job/coupang-blog-post-job/coupang-blog-post-job.processor'
import { JobLogsService } from '@main/app/modules/job/job-logs/job-logs.service'
import { TopicJobProcessor } from '@main/app/modules/job/topic-job/topic-job.processor'
import { IndexJobProcessor } from '@main/app/modules/job/index-job/index-job.processor'

@Injectable()
export class JobQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobQueueProcessor.name)
  private processors: Partial<Record<JobTargetType, JobProcessor>>
  private readonly defaultConcurrencyPerType = 1

  constructor(
    private readonly prisma: PrismaService,
    private readonly infoBlogPostJobProcessor: InfoBlogPostJobProcessor,
    private readonly coupangBlogPostJobProcessor: CoupangBlogPostJobProcessor,
    private readonly topicJobProcessor: TopicJobProcessor,
    private readonly jobLogsService: JobLogsService,
    private readonly indexJobProcessor: IndexJobProcessor,
    private readonly agodaBlogPostJobProcessor: AgodaBlogPostJobProcessor,
  ) {}

  async onModuleInit() {
    this.processors = {
      [JobTargetType.GENERATE_TOPIC]: this.topicJobProcessor,
      [JobTargetType.BLOG_INFO_POSTING]: this.infoBlogPostJobProcessor,
      [JobTargetType.COUPANG_REVIEW_POSTING]: this.coupangBlogPostJobProcessor,
      [JobTargetType.INDEX]: this.indexJobProcessor,
      [JobTargetType.AGODA_POSTING]: this.agodaBlogPostJobProcessor,
    }
    // 1. 시작 직후 processing 상태인 것들을 error 처리 (중간에 강제종료된 경우)
    await this._removeUnprocessedJobs()
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processNextJobs() {
    const targetTypes = Object.values(JobTargetType)
    await Promise.all(targetTypes.map(async targetType => this._processNextJobsForType(targetType)))
  }

  public async processJob(job: Job) {
    const processor = this.processors[job.targetType as JobTargetType]
    if (!processor || !processor.canProcess(job)) {
      this.logger.error(`No valid processor for job type ${job.targetType}`)
      await this._markJobAsFailed(job.id, `No valid processor for job type ${job.targetType}`)
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
      await this._markJobAsFailed(job.id, error.message)
    }
  }

  private async _processNextJobsForType(targetType: JobTargetType) {
    const maxConcurrency = this._getMaxConcurrencyForType(targetType)
    if (maxConcurrency <= 0) {
      return
    }

    const processingCount = await this.prisma.job.count({
      where: {
        status: JobStatus.PROCESSING,
        targetType,
      },
    })

    const availableSlots = maxConcurrency - processingCount
    if (availableSlots <= 0) {
      return
    }

    const requestJobs = await this.prisma.job.findMany({
      where: {
        status: JobStatus.REQUEST,
        targetType,
        scheduledAt: { lte: new Date() },
      },
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
      take: availableSlots,
    })

    await Promise.all(requestJobs.map(async job => this.processJob(job)))
  }

  private _getMaxConcurrencyForType(targetType: JobTargetType): number {
    // 추후 환경설정이나 config 모듈과 연동할 때 이 메서드만 수정하면 됩니다.
    // 현재는 모든 타입에 대해 동일한 기본 동시 처리 개수만 적용합니다.
    return this.defaultConcurrencyPerType
  }

  private async _markJobAsFailed(jobId: string, errorMsg: string) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        errorMsg,
        completedAt: new Date(),
      },
    })
  }

  private async _removeUnprocessedJobs() {
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
}
