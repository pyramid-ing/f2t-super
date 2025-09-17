import { Body, Controller, Delete, Get, Logger, Param, Post, Put } from '@nestjs/common'
import { SiteConfigService } from '@main/app/modules/site-config/site-config.service'

@Controller('sites')
export class SiteConfigController {
  private readonly logger = new Logger(SiteConfigController.name)

  constructor(private readonly siteConfigService: SiteConfigService) {}

  @Get()
  async getAllSites() {
    return await this.siteConfigService.getAllSiteConfigs()
  }

  @Get('active')
  async getActiveSites() {
    return await this.siteConfigService.getActiveSites()
  }

  @Get(':siteId')
  async getSite(@Param('siteId') siteId: string) {
    return await this.siteConfigService.getSiteConfig(Number.parseInt(siteId))
  }

  @Get('domain/:domain')
  async getSiteByDomain(@Param('domain') domain: string) {
    return await this.siteConfigService.getSiteConfigByDomain(decodeURIComponent(domain))
  }

  @Post()
  async createSite(@Body() siteData: any) {
    return await this.siteConfigService.createSiteConfig(siteData)
  }

  @Put(':siteId')
  async updateSite(@Param('siteId') siteId: string, @Body() updateData: any) {
    return await this.siteConfigService.updateSiteConfig(Number.parseInt(siteId), updateData)
  }

  @Put(':siteId/engines')
  async updateSiteEngineConfigs(@Param('siteId') siteId: string, @Body() configs: any) {
    return await this.siteConfigService.updateSiteEngineConfigs(Number.parseInt(siteId), configs)
  }

  @Delete(':siteId')
  async deleteSite(@Param('siteId') siteId: string) {
    return await this.siteConfigService.deleteSiteConfig(Number.parseInt(siteId))
  }
}
