import { Module } from '@nestjs/common'
import { CoupangCrawlerController } from './coupang-crawler.controller'
import { CoupangCrawlerService } from './coupang-crawler.service'

@Module({
  controllers: [CoupangCrawlerController],
  providers: [CoupangCrawlerService],
  exports: [CoupangCrawlerService],
})
export class CoupangCrawlerModule {}
