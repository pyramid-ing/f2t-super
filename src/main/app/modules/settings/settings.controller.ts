import { Body, Controller, Get, Post, UploadedFile, UseInterceptors, Res } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { SettingsService } from './settings.service'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings()
  }

  @Get('ai/models')
  async getAiModels() {
    return this.settingsService.getAiModels()
  }

  @Post()
  async updateSettings(@Body() settings: any) {
    return this.settingsService.updateSettings(settings)
  }

  /**
   * 프록시 엑셀 업로드
   */
  @Post('proxies/excel')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProxiesExcel(@UploadedFile() file: Express.Multer.File) {
    return this.settingsService.importProxiesFromExcel(file)
  }

  /**
   * 프록시 샘플 엑셀 다운로드
   */
  @Get('proxies/sample-excel')
  async downloadProxySample(@Res() res: Response) {
    const { buffer, filename } = this.settingsService.generateProxySampleExcel()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }
}
