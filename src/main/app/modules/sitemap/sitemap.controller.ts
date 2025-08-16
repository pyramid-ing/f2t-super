import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { SitemapService } from './sitemap.service'

interface IndexingConfig {
  mode: 'recentCount' | 'recentDays' | 'fromDate' | 'all'
  count?: number
  days?: number
  startDate?: string
}

@Controller('sitemap')
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  /**
   * 사이트의 모든 사이트맵 설정 가져오기
   */
  @Get('configs/:siteId')
  async getSitemapConfigs(@Param('siteId') siteId: string) {
    return await this.sitemapService.getSitemapConfigs(parseInt(siteId))
  }

  /**
   * 사이트맵 설정 생성
   */
  @Post('configs/:siteId')
  async createSitemapConfig(@Param('siteId') siteId: string, @Body() data: any) {
    return await this.sitemapService.createSitemapConfig(parseInt(siteId), data)
  }

  /**
   * 사이트맵 설정 업데이트
   */
  @Put('configs/:id')
  async updateSitemapConfig(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string
      sitemapType?: string
      isEnabled?: boolean
    },
  ) {
    return await this.sitemapService.updateSitemapConfig(id, data)
  }

  /**
   * 사이트맵 설정 삭제
   */
  @Delete('configs/:id')
  async deleteSitemapConfig(@Param('id') id: string) {
    return await this.sitemapService.deleteSitemapConfig(id)
  }

  /**
   * 사이트의 색인 기준 설정 가져오기
   */
  @Get('indexing-config/:siteId')
  async getIndexingConfig(@Param('siteId') siteId: string) {
    return await this.sitemapService.getIndexingConfig(parseInt(siteId))
  }

  /**
   * 사이트의 색인 기준 설정 업데이트
   */
  @Put('indexing-config/:siteId')
  async updateIndexingConfig(@Param('siteId') siteId: string, @Body() config: any) {
    return await this.sitemapService.updateIndexingConfig(parseInt(siteId), config)
  }

  /**
   * 사이트의 인덱싱 작업 목록 가져오기
   */
  @Get('jobs/:siteId')
  async getIndexJobs(@Param('siteId') siteId: string, @Query('page') page = '1', @Query('limit') limit = '50') {
    return await this.sitemapService.getIndexJobs(parseInt(siteId), parseInt(page), parseInt(limit))
  }

  /**
   * 수동으로 sitemap 파싱 실행
   */
  @Post('parse/:siteId')
  async parseSitemap(@Param('siteId') siteId: string) {
    return await this.sitemapService.parseSitemap(parseInt(siteId))
  }
}
