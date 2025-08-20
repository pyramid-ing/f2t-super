import { Module } from '@nestjs/common'
import { AgodaSearchService } from './agoda-search.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [CommonModule, SettingsModule],
  providers: [AgodaSearchService],
  exports: [AgodaSearchService],
})
export class AgodaSearchModule {}
