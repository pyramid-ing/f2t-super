import { Module } from '@nestjs/common'
import { SettingsModule } from '../../settings/settings.module'
import { GoogleAuthService } from '@main/app/modules/google/auth/google-auth.service'

@Module({
  imports: [SettingsModule],
  providers: [GoogleAuthService],
  exports: [GoogleAuthService],
})
export class GoogleAuthModule {}
