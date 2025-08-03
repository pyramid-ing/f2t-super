import { Injectable } from '@nestjs/common'
import { GeminiService } from './gemini.service'
import { SettingsService } from '../settings/settings.service'
import { AIService } from './ai.interface'

@Injectable()
export class AIFactory {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly settingsService: SettingsService,
  ) {}

  async getAIService(): Promise<AIService> {
    const settings = await this.settingsService.getSettings()
    const provider = settings.aiProvider

    switch (provider) {
      case 'gemini':
      default:
        return this.geminiService
    }
  }
}
