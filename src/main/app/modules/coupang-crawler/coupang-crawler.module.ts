import { Module } from '@nestjs/common'
import { CoupangCrawlerController } from './coupang-crawler.controller'
import { CoupangCrawlerService } from './coupang-crawler.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [CommonModule, SettingsModule],
  controllers: [CoupangCrawlerController],
  providers: [CoupangCrawlerService],
  exports: [CoupangCrawlerService],
})
export class CoupangCrawlerModule {}
