import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '../settings/settings.service'
import { GoogleGenAI } from '@google/genai'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { UtilService } from '../util/util.service'

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name)
  private gemini: GoogleGenAI | null = null

  constructor(
    private readonly settingsService: SettingsService,
    private readonly utilService: UtilService,
  ) {}

  async initialize(): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.geminiApiKey

    if (!apiKey) {
      throw new CustomHttpException(ErrorCode.GEMINI_API_KEY_REQUIRED)
    }

    this.gemini = new GoogleGenAI({ apiKey: apiKey.trim() })
  }

  async getGemini(): Promise<GoogleGenAI> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.geminiApiKey

    if (!apiKey) {
      throw new CustomHttpException(ErrorCode.GEMINI_API_KEY_REQUIRED)
    }

    return new GoogleGenAI({ apiKey: apiKey.trim() })
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    // 길이 체크: Gemini API 키는 일반적으로 32~128자 내외
    if (!apiKey || apiKey.trim().length < 32 || apiKey.trim().length > 128) {
      throw new CustomHttpException(ErrorCode.AI_KEY_INVALID, {
        reason: 'API 키 길이가 올바르지 않습니다. 올바른 길이의 키를 입력해주세요.',
        length: apiKey?.length,
      })
    }
    try {
      const genAI = new GoogleGenAI({ apiKey: apiKey.trim() })
      const result = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: 'hello',
        config: {
          maxOutputTokens: 10,
        },
      })
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

  private parseErrorObject(error: any): any {
    if (error?.message && typeof error.message === 'string') {
      try {
        return JSON.parse(error.message)
      } catch {
        // JSON 파싱 실패 시 원본 error 사용
      }
    }
    return error
  }

  private isGeminiApiKeyInvalidError(error: any): boolean {
    const errorObj = this.parseErrorObject(error)

    return (
      errorObj?.error?.code === 400 &&
      errorObj?.error?.status === 'INVALID_ARGUMENT' &&
      Array.isArray(errorObj?.error?.details) &&
      errorObj.error.details.some(
        detail => detail['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' && detail.reason === 'API_KEY_INVALID',
      )
    )
  }

  private isGeminiQuotaError(error: any): error is GeminiQuotaError {
    const errorObj = this.parseErrorObject(error)

    return (
      errorObj?.error?.code === 429 &&
      errorObj?.error?.status === 'RESOURCE_EXHAUSTED' &&
      Array.isArray(errorObj?.error?.details)
    )
  }

  private getRetryDelay(error: any): number {
    if (this.isGeminiQuotaError(error)) {
      const retryInfo = error.error.details.find(detail => detail['@type']?.includes('RetryInfo'))
      if (retryInfo?.retryDelay) {
        // retryDelay format is "51s", convert to seconds
        return parseInt(retryInfo.retryDelay.replace('s', ''))
      }
    }
    return 60 // 기본 60초
  }

  private handleGeminiError(error: any): never {
    this.logger.error('Gemini API 호출 중 오류:', error)

    // API 키 유효하지 않음 에러 처리
    if (this.isGeminiApiKeyInvalidError(error)) {
      throw new CustomHttpException(ErrorCode.AI_KEY_INVALID, {
        reason: 'API 키가 유효하지 않습니다. 올바른 API 키를 입력해주세요.',
        provider: 'gemini',
      })
    }

    if (this.isGeminiQuotaError(error)) {
      const retryDelay = this.getRetryDelay(error)
      throw new CustomHttpException(ErrorCode.AI_QUOTA_EXCEEDED, { retryDelay, provider: 'gemini' })
    }

    if (error.message?.includes('not found')) {
      throw new CustomHttpException(ErrorCode.AI_API_ERROR, { reason: 'API not found', provider: 'gemini' })
    }

    // 503 에러 (모델 과부하) 처리
    if (error?.error?.code === 503 || error.message?.includes('overloaded')) {
      throw new CustomHttpException(ErrorCode.AI_API_ERROR, {
        reason: '모델이 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
        provider: 'gemini',
      })
    }

    throw new CustomHttpException(ErrorCode.AI_API_ERROR, { message: error.message, provider: 'gemini' })
  }
}
