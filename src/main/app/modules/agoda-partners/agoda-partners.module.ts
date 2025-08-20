import { Module } from '@nestjs/common'
import { AgodaPartnersService } from './agoda-partners.service'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [AgodaPartnersService],
  exports: [AgodaPartnersService],
})
export class AgodaPartnersModule {}
