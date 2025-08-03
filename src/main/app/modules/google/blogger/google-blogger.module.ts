import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { GoogleBloggerController } from './google-blogger.controller'
import { GoogleBloggerService } from './google-blogger.service'
import { GoogleBloggerAccountService } from './google-blogger-account.service'
import { GoogleBloggerApiService } from './google-blogger-api.service'
import { GoogleOauthModule } from '../oauth/google-oauth.module'
import { PrismaModule } from '@main/app/modules/common/prisma/prisma.module'

@Module({
  imports: [HttpModule, GoogleOauthModule, PrismaModule],
  controllers: [GoogleBloggerController],
  providers: [GoogleBloggerService, GoogleBloggerAccountService, GoogleBloggerApiService],
  exports: [GoogleBloggerService, GoogleBloggerAccountService, GoogleBloggerApiService],
})
export class GoogleBloggerModule {}
