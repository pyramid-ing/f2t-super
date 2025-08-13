import { Injectable, Logger } from '@nestjs/common'
import { TopicResult } from './topic-job.types'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { Type } from '@google/genai'

@Injectable()
export class TopicService {
  private readonly logger = new Logger(TopicService.name)

  constructor(private readonly geminiService: GeminiService) {}

  async generateTopics(topic: string, limit: number): Promise<TopicResult[]> {
    this.logger.log(`주제 "${topic}"에 대한 토픽 생성을 시작합니다. (개수: ${limit})`)

    const prompt = `다음 주제에 대해 SEO에 최적화된 블로그 제목 ${limit}개를 생성해주세요.
주제: ${topic}

규칙:
1. 각 제목은 검색 엔진 최적화(SEO)를 고려하여 작성
2. 클릭을 유도하는 매력적인 제목
3. 40-60자 내외로 작성
4. 한글로 작성
5. 숫자나 리스트 형식 선호
6. 각 제목은 새로운 줄에 작성

응답 형식:
[
  {
    "title": "제목1",
    "content": "내용1"
  }
]
※ 반드시 위 JSON 배열만 반환하세요. 불필요한 텍스트, 설명, 마크다운 금지.
`

    const gemini = await this.geminiService.getGemini()
    const result = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
            },
            required: ['title', 'content'],
          },
        },
      },
    })

    // 이전: JSON.parse(result.text).titles
    const topics: TopicResult[] = JSON.parse(result.text)

    this.logger.log(`${topics.length}개의 토픽이 생성되었습니다.`)
    return topics
  }
}
