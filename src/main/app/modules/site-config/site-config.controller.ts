import { Body, Controller, Delete, Get, Logger, Param, Post, Put } from '@nestjs/common'
import { SiteConfigService } from '@main/app/modules/site-config/site-config.service'

@Controller('sites')
export class SiteConfigController {
  private readonly logger = new Logger(SiteConfigController.name)

  constructor(private readonly siteConfigService: SiteConfigService) {}

  @Get()
  async getAllSites() {
    try {
      return await this.siteConfigService.getAllSiteConfigs()
    } catch (error) {
      this.logger.error('사이트 목록 조회 실패:', error)
      throw error
    }
  }

  @Get('active')
  async getActiveSites() {
    try {
      return await this.siteConfigService.getActiveSites()
    } catch (error) {
      this.logger.error('활성 사이트 목록 조회 실패:', error)
      throw error
    }
  }

  @Get(':siteId')
  async getSite(@Param('siteId') siteId: string) {
    try {
      return await this.siteConfigService.getSiteConfig(Number.parseInt(siteId))
    } catch (error) {
      this.logger.error('사이트 조회 실패:', error)
      throw error
    }
  }

  @Get('domain/:domain')
  async getSiteByDomain(@Param('domain') domain: string) {
    try {
      return await this.siteConfigService.getSiteConfigByDomain(decodeURIComponent(domain))
    } catch (error) {
      this.logger.error('도메인별 사이트 조회 실패:', error)
      throw error
    }
  }

  @Post()
  async createSite(@Body() siteData: any) {
    try {
      return await this.siteConfigService.createSiteConfig(siteData)
    } catch (error) {
      this.logger.error('사이트 생성 실패:', error)
      throw error
    }
  }

  @Put(':siteId')
  async updateSite(@Param('siteId') siteId: string, @Body() updateData: any) {
    try {
      return await this.siteConfigService.updateSiteConfig(Number.parseInt(siteId), updateData)
    } catch (error) {
      this.logger.error('사이트 업데이트 실패:', error)
      throw error
    }
  }

  @Put(':siteId/engines')
  async updateSiteEngineConfigs(@Param('siteId') siteId: string, @Body() configs: any) {
    try {
      return await this.siteConfigService.updateSiteEngineConfigs(Number.parseInt(siteId), configs)
    } catch (error) {
      this.logger.error('사이트 검색엔진 설정 업데이트 실패:', error)
      throw error
    }
  }

  @Delete(':siteId')
  async deleteSite(@Param('siteId') siteId: string) {
    try {
      return await this.siteConfigService.deleteSiteConfig(Number.parseInt(siteId))
    } catch (error) {
      this.logger.error('사이트 삭제 실패:', error)
      throw error
    }
  }
}
