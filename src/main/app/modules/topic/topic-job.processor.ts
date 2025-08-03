import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobProcessor, JobResult, JobTargetType } from '@main/app/modules/job/job.types'
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
    return job.targetType === JobTargetType.GENERATE_TOPIC
  }

  /**
   * JobProcessor 인터페이스 구현
   */
  async process(jobId: string): Promise<JobResult> {
    this.logger.log(`토픽 작업 처리 시작: ${jobId}`)

    try {
      const result = await this.topicJobService.processTopicJob(jobId)
      this.logger.log(`토픽 작업 처리 완료: ${jobId}, 결과: ${result.resultMsg}`)

      return {
        resultMsg: result.resultMsg,
      }
    } catch (error) {
      this.logger.error(`토픽 작업 처리 실패: ${jobId}`, error)

      // 작업 상태를 실패로 업데이트
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          resultMsg: `토픽 작업 처리 실패: ${error.message}`,
        },
      })

      throw error
    }
  }
}
