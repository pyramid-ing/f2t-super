import { Module } from '@nestjs/common'
import { CoupangCrawlerController } from './coupang-crawler.controller'
import { CoupangCrawlerService } from './coupang-crawler.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [CoupangCrawlerController],
  providers: [CoupangCrawlerService],
  exports: [CoupangCrawlerService],
})
export class CoupangCrawlerModule {}
