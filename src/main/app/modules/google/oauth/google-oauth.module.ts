import { Module } from '@nestjs/common'
import { GoogleOauthService } from './google-oauth.service'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { SettingsModule } from '../../settings/settings.module'
import { HttpModule } from '@nestjs/axios'
import { GoogleOAuthController } from '@main/app/modules/google/oauth/google-oauth.controller'

@Module({
  imports: [PrismaModule, SettingsModule, HttpModule],
  controllers: [GoogleOAuthController],
  providers: [GoogleOauthService],
  exports: [GoogleOauthService],
})
export class GoogleOauthModule {}
