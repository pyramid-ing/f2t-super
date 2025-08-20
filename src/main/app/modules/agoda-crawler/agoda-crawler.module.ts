import { Module } from '@nestjs/common'
import { AgodaCrawlerService } from 'src/main/app/modules/agoda-crawler/agoda-crawler.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [CommonModule, SettingsModule],
  providers: [AgodaCrawlerService],
  exports: [AgodaCrawlerService],
})
export class AgodaCrawlerModule {}
