import { Injectable, Logger } from '@nestjs/common'
import { Topic } from '@main/app/modules/ai/ai.interface'
import { AIFactory } from '@main/app/modules/ai/ai.factory'
import { TopicResult } from './topic-job.types'

@Injectable()
export class TopicService {
  private readonly logger = new Logger(TopicService.name)

  constructor(private readonly aiFactory: AIFactory) {}

  async generateTopics(topic: string, limit: number): Promise<TopicResult[]> {
    this.logger.log(`주제 "${topic}"에 대한 토픽 생성을 시작합니다. (개수: ${limit})`)

    try {
      const aiService = await this.aiFactory.getAIService()
      const topics: Topic[] = await aiService.generateTopics(topic, limit)

      // Topic[]을 TopicResult[]로 변환
      const topicResults: TopicResult[] = topics.map(topic => ({
        title: topic.title,
        content: topic.content,
      }))

      this.logger.log(`${topicResults.length}개의 토픽이 생성되었습니다.`)
      return topicResults
    } catch (error) {
      this.logger.error(`토픽 생성 실패: ${topic}`, error)
      throw error
    }
  }
}
