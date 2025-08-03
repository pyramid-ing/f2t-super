import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobProcessor, JobResult, JobType } from '@main/app/modules/job/job.types'
import { Job } from '@prisma/client'
import { TopicJobService } from './topic-job.service'

@Injectable()
export class TopicJobProcessor implements JobProcessor {
  private readonly logger = new Logger(TopicJobProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly topicJobService: TopicJobService,
  ) {}

  canProcess(job: Job): boolean {
    return job.targetType === JobType.GENERATE_TOPIC
  }

  /**
   * JobProcessor 인터페이스 구현
   */
  async process(jobId: string): Promise<JobResult> {
    try {
      const result = await this.topicJobService.processTopicJob(jobId)

      return {
        resultMsg: result.resultMsg,
      }
    } catch (error) {
      this.logger.error('TopicJob 처리 실패:', error)
      throw error
    }
  }
}
