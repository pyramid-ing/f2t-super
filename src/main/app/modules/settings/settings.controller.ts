import { Body, Controller, Get, Post } from '@nestjs/common'
import { SettingsService } from './settings.service'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings()
  }

  @Post()
  async updateSettings(@Body() settings: any) {
    return this.settingsService.updateSettings(settings)
  }
}
