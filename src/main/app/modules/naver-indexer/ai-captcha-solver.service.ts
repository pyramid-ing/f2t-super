import { Injectable, Logger } from '@nestjs/common'
import { CaptchaSolver } from './naver-indexer.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'

@Injectable()
export class AiCaptchaSolverService implements CaptchaSolver {
  private readonly logger = new Logger(AiCaptchaSolverService.name)

  constructor(private readonly prisma: PrismaService) {}

  async solveCaptcha(imageBase64: string): Promise<string> {
    try {
      this.logger.log('AI 서비스를 이용한 캡챠 해제를 시도합니다.')

      // base64 이미지를 OpenAI API에 전송하여 텍스트 추출
      const solution = await this.analyzeImageWithAI(imageBase64)

      if (solution) {
        this.logger.log(`캡챠 해제 완료: ${solution}`)
        return solution
      } else {
        throw new CustomHttpException(ErrorCode.NAVER_CAPTCHA_SOLVE_FAILED, {
          errorMessage: 'AI 서비스가 캡챠 해답을 추출하지 못했습니다.',
        })
      }
    } catch (error) {
      this.logger.error('AI 캡챠 해제 실패:', error)
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.NAVER_AI_SERVICE_ERROR, {
        errorMessage: error.message,
      })
    }
  }

  private async analyzeImageWithAI(imageBase64: string): Promise<string> {
    try {
      // 전역 설정에서 OpenAI API 키 가져오기
      const settings = await this.prisma.settings.findFirst({ where: { id: 2 } })
      if (!settings) {
        throw new CustomHttpException(ErrorCode.NAVER_AI_SERVICE_ERROR, {
          errorMessage: '전역 설정을 찾을 수 없습니다.',
        })
      }

      const globalSettings = JSON.parse(settings.data)
      const aiSettings = globalSettings.ai

      if (!aiSettings?.use || !aiSettings?.openaiApiKey) {
        throw new CustomHttpException(ErrorCode.NAVER_AI_SERVICE_ERROR, {
          errorMessage: 'AI 설정이 활성화되지 않았거나 OpenAI API 키가 설정되지 않았습니다.',
        })
      }

      const openaiApiKey = aiSettings.openaiApiKey

      // OpenAI API 호출
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [
            { role: 'system', content: '영수증이미지 데이터 입니다. 이미지와 질문을 보고 답만 반환하세요.' },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 50,
          temperature: 0,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new CustomHttpException(ErrorCode.NAVER_AI_SERVICE_ERROR, {
          errorMessage: `OpenAI API 호출 실패: ${errorData.error?.message || response.statusText}`,
        })
      }

      const data = await response.json()
      const solution = data.choices?.[0]?.message?.content?.trim()

      if (!solution) {
        throw new CustomHttpException(ErrorCode.NAVER_CAPTCHA_SOLVE_FAILED, {
          errorMessage: 'AI 서비스가 응답을 반환하지 않았습니다.',
        })
      }

      return solution
    } catch (error) {
      this.logger.error('OpenAI API 호출 중 오류:', error)
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.NAVER_AI_SERVICE_ERROR, {
        errorMessage: error.message,
      })
    }
  }
}
