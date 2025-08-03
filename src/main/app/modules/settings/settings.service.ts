import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AppSettings } from './settings.types'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AppSettings> {
    const settings = await this.prisma.settings.findFirst({
      where: { id: 1 },
    })

    const defaultSettings: AppSettings = {
      aiProvider: 'gemini',
      publishType: 'google',
    }
    const merged = {
      ...defaultSettings,
      ...(settings?.data as unknown as AppSettings),
    }
    return merged
  }

  async updateSettings(newSettings: Partial<AppSettings>) {
    const currentSettings = await this.getSettings()
    const mergedSettings = {
      ...currentSettings,
      ...newSettings,
      aiProvider: 'gemini',
    }
    await this.prisma.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        data: mergedSettings,
      },
      update: {
        data: mergedSettings,
      },
    })

    return mergedSettings
  }
}
