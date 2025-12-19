import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '../settings/settings.service'
import { GoogleGenAI } from '@google/genai'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { retry } from '@main/app/utils/retry'

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name)
  private readonly DEFAULT_TEXT_MODEL = 'gemini-2.5-pro'

  constructor(private readonly settingsService: SettingsService) {}

  public async getDefaultTextModel(): Promise<string> {
    const settings = await this.settingsService.getSettings()
    return settings.aiModel ?? this.DEFAULT_TEXT_MODEL
  }

  public async getGemini(): Promise<GoogleGenAI> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.geminiApiKey

    if (!apiKey) {
      throw new CustomHttpException(ErrorCode.GEMINI_API_KEY_REQUIRED)
    }

    return new GoogleGenAI({ apiKey: apiKey.trim() })
  }

  public async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    // 길이 체크: Gemini API 키는 일반적으로 32~128자 내외
    if (!apiKey || apiKey.trim().length < 32 || apiKey.trim().length > 128) {
      throw new CustomHttpException(ErrorCode.AI_KEY_INVALID, {
        reason: 'API 키 길이가 올바르지 않습니다. 올바른 길이의 키를 입력해주세요.',
        length: apiKey?.length,
      })
    }
    try {
      const genAI = new GoogleGenAI({ apiKey: apiKey.trim() })
      const result = await retry(
        () =>
          genAI.models.generateContent({
            model: 'gemini-2.0-flash-lite',
            contents: 'hello',
            config: {
              maxOutputTokens: 10,
            },
          }),
        10000, // 10초 간격
        5, // 최대 5회 재시도
        'linear',
      )
      const response = result.text

      if (!response) {
        throw new CustomHttpException(ErrorCode.AI_API_ERROR, { reason: 'API 응답이 비어있음' })
      }

      return {
        valid: true,
        model: 'gemini-2.0-flash-lite',
      }
    } catch (error) {
      this.logger.error('Gemini API 키 검증 실패:', error)

      if (error.message?.includes('API key not valid')) {
        throw new CustomHttpException(ErrorCode.AI_KEY_INVALID, {
          reason: 'API 키가 유효하지 않습니다. 올바른 API 키를 입력해주세요.',
        })
      } else if (error.message?.includes('ByteString') || error.message?.includes('character at index')) {
        throw new CustomHttpException(ErrorCode.AI_KEY_INVALID, {
          reason: 'API 키 형식이 올바르지 않습니다. 영문/숫자만 입력해주세요.',
          detail: error.message,
        })
      } else if (error.message?.includes('quota')) {
        throw new CustomHttpException(ErrorCode.AI_QUOTA_EXCEEDED, {
          reason: 'API 할당량이 초과되었습니다. 나중에 다시 시도해주세요.',
        })
      } else if (error.message?.includes('permission')) {
        throw new CustomHttpException(ErrorCode.AI_NO_PERMISSION, { reason: 'API 키에 필요한 권한이 없습니다.' })
      } else if (error.message?.includes('not found')) {
        throw new CustomHttpException(ErrorCode.AI_API_ERROR, {
          reason: 'API 버전 또는 모델이 올바르지 않습니다. Gemini API가 활성화되어 있는지 확인해주세요.',
        })
      }

      throw new CustomHttpException(ErrorCode.AI_API_ERROR, { message: error.message })
    }
  }
}
