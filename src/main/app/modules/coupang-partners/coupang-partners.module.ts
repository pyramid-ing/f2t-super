import { Module } from '@nestjs/common'
import { CoupangPartnersController } from './coupang-partners.controller'
import { CoupangPartnersService } from './coupang-partners.service'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  controllers: [CoupangPartnersController],
  providers: [CoupangPartnersService],
  exports: [CoupangPartnersService],
})
export class CoupangPartnersModule {}
