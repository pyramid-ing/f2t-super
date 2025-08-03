import { Controller, Post, Body } from '@nestjs/common'
import { CoupangCrawlerService } from './coupang-crawler.service'
import { CoupangProductData, CoupangCrawlerOptions } from './coupang-crawler.types'

export class CrawlProductInfoDto {
  coupangUrl: string
  options?: CoupangCrawlerOptions
}

@Controller('coupang-crawler')
export class CoupangCrawlerController {
  constructor(private readonly coupangCrawlerService: CoupangCrawlerService) {}

  /**
   * 상품 정보 크롤링
   */
  @Post('product-info')
  async crawlProductInfo(@Body() dto: CrawlProductInfoDto): Promise<CoupangProductData> {
    return this.coupangCrawlerService.crawlProductInfo(dto.coupangUrl, dto.options)
  }
}
