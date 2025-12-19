import { Injectable, Logger } from '@nestjs/common'
import { TopicResult } from './topic-job.types'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { retry } from '@main/app/utils/retry'
import { Type } from '@google/genai'
import { SettingsService } from '@main/app/modules/settings/settings.service'

@Injectable()
export class TopicService {
  private readonly logger = new Logger(TopicService.name)

  constructor(
    private readonly geminiService: GeminiService,
    private readonly settingsService: SettingsService,
  ) {}

  public async generateTopics(topic: string, limit: number): Promise<TopicResult[]> {
    this.logger.log(`주제 "${topic}"에 대한 토픽 생성을 시작합니다. (개수: ${limit})`)

    const language = await this._getInfoBlogLanguage()
    const languageName = this._getLanguageDisplayName(language)
    const prompt = `다음 주제에 대해 SEO에 최적화된 블로그 제목 ${limit}개를 생성해주세요.
주제: ${topic}

규칙:
1. 각 제목은 검색 엔진 최적화(SEO)를 고려하여 작성
2. 클릭을 유도하는 매력적인 제목
3. 40-60자 내외로 작성
4. ${languageName}로 작성
5. 숫자나 리스트 형식 선호
6. 각 제목은 새로운 줄에 작성
7. 응답 JSON의 title/content 값도 반드시 ${languageName}로 작성

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
    const result = await retry(
      () =>
        gemini.models.generateContent({
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
        }),
      10000, // 10초 간격
      5, // 최대 5회 재시도
      'linear',
    )

    // 이전: JSON.parse(result.text).titles
    const topics: TopicResult[] = JSON.parse(result.text)

    this.logger.log(`${topics.length}개의 토픽이 생성되었습니다.`)
    return topics
  }

  private async _getInfoBlogLanguage(): Promise<string> {
    const settings = await this.settingsService.getSettings()
    const raw = (settings as any)?.infoBlogLanguage
    return typeof raw === 'string' && raw.trim() ? raw.trim().toLowerCase() : 'ko'
  }

  private _getLanguageDisplayName(language?: string): string {
    const code = (language || '').trim().toLowerCase()
    switch (code) {
      case 'en':
        return '영어'
      case 'ja':
        return '일본어'
      case 'zh':
        return '중국어'
      case 'vi':
        return '베트남어'
      case 'th':
        return '태국어'
      case 'id':
        return '인도네시아어'
      case 'ms':
        return '말레이어'
      case 'tl':
        return '타갈로그어'
      case 'hi':
        return '힌디어'
      case 'bn':
        return '벵골어'
      case 'ur':
        return '우르두어'
      case 'ar':
        return '아랍어'
      case 'tr':
        return '터키어'
      case 'de':
        return '독일어'
      case 'fr':
        return '프랑스어'
      case 'es':
        return '스페인어'
      case 'pt':
        return '포르투갈어'
      case 'ru':
        return '러시아어'
      case 'it':
        return '이탈리아어'
      case 'ko':
      default:
        return '한국어'
    }
  }
}
