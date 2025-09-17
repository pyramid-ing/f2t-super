import { Module } from '@nestjs/common'
import { CoupangPartnersService } from './coupang-partners.service'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  controllers: [],
  providers: [CoupangPartnersService],
  exports: [CoupangPartnersService],
})
export class CoupangPartnersModule {}
