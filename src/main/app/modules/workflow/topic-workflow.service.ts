import { Injectable, Logger } from '@nestjs/common'
import { TopicJobService } from '@main/app/modules/job/topic-job/topic-job.service'

export interface TopicWorkflowResult {
  success: boolean
  message: string
  jobId: string
}

@Injectable()
export class TopicWorkflowService {
  private readonly logger = new Logger(TopicWorkflowService.name)

  constructor(private readonly topicJobService: TopicJobService) {}

  /**
   * 토픽 찾기 워크플로우를 처리합니다.
   */
  public async processFindTopics(
    topic: string,
    limit: number,
    immediateRequest: string | boolean | undefined,
  ): Promise<TopicWorkflowResult> {
    // 즉시요청 여부 파싱
    const immediate = this._parseImmediateRequest(immediateRequest)

    // 토픽 생성 job 등록
    const job = await this.topicJobService.createTopicJob(topic, limit, immediate)

    this.logger.log(`✅ 토픽 생성 작업이 등록됨: ${job.id}`)

    return {
      success: true,
      message: '토픽 생성 작업이 등록되었습니다.',
      jobId: job.id,
    }
  }

  /**
   * 즉시요청 여부를 파싱합니다.
   */
  private _parseImmediateRequest(value: string | boolean | undefined): boolean {
    switch (typeof value) {
      case 'boolean':
        return value
      case 'string':
        switch (value) {
          case 'true':
          case '1':
            return true
          case 'false':
          case '0':
            return false
          default:
            return true
        }
      default:
        return true
    }
  }
}
