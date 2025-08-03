import { Body, Controller, Post } from '@nestjs/common'
import { ValidateAIKeyDto } from '../settings/dto/validate-ai-key.dto'
import { GeminiService } from './gemini.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Controller('ai')
export class AIController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('validate-key')
  async validateAIKey(@Body() dto: ValidateAIKeyDto & { provider: 'gemini' }) {
    if (dto.provider !== 'gemini') {
      throw new CustomHttpException(ErrorCode.AI_PROVIDER_NOT_SUPPORTED, {
        message: '지원하지 않는 AI 제공자입니다.',
      })
    }
    return this.geminiService.validateApiKey(dto.apiKey)
  }
}
