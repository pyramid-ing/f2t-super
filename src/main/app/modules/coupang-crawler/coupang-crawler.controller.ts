import { Controller, Post, Body, UseGuards } from '@nestjs/common'
import { CoupangCrawlerService } from './coupang-crawler.service'
import { CoupangProductData, CoupangCrawlerOptions } from './coupang-crawler.types'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

export class CrawlProductInfoDto {
  coupangUrl: string
  options?: CoupangCrawlerOptions
}

@Controller('coupang-crawler')
@UseGuards(AuthGuard)
export class CoupangCrawlerController {
  constructor(private readonly coupangCrawlerService: CoupangCrawlerService) {}

  /**
   * 상품 정보 크롤링
   */
  @Post('product-info')
  @Permissions(Permission.USE_INFO_POSTING)
  async crawlProductInfo(@Body() dto: CrawlProductInfoDto): Promise<CoupangProductData> {
    return this.coupangCrawlerService.crawlProductInfo(dto.coupangUrl, dto.options)
  }
}
