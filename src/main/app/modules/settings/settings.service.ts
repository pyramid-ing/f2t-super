import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AppSettings } from './settings.types'
import { BlogType } from '@main/app/modules/job/job.types'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  public async getSettings(): Promise<AppSettings> {
    const settings = await this.prisma.settings.findFirst({
      where: { id: 1 },
    })

    const defaultSettings: AppSettings = {
      aiProvider: 'gemini',
      publishType: BlogType.WORDPRESS,
      thumbnailEnabled: true, // 기본값을 true로 설정
    }
    const merged = {
      ...defaultSettings,
      ...(settings?.data as unknown as AppSettings),
    }
    return merged
  }

  public async updateSettings(newSettings: Partial<AppSettings>) {
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
