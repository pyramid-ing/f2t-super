import { Injectable, Logger } from '@nestjs/common'
import { Topic } from '@main/app/modules/ai/ai.interface'
import { AIFactory } from '@main/app/modules/ai/ai.factory'

@Injectable()
export class TopicService {
  private readonly logger = new Logger(TopicService.name)

  constructor(private readonly aiFactory: AIFactory) {}

  async generateTopics(topic: string, limit: number): Promise<Topic[]> {
    this.logger.log(`주제 "${topic}"에 대한 주제 생성을 시작합니다.`)

    const aiService = await this.aiFactory.getAIService()
    const titles = await aiService.generateTopics(topic, limit)
    this.logger.log(`${titles.length}개의 주제가 생성되었습니다.`)
    return titles
  }
}
