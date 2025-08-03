import { Module } from '@nestjs/common'
import { GoogleOauthModule } from 'src/main/app/modules/google/oauth/google-oauth.module'
import { GoogleBloggerModule } from '@main/app/modules/google/blogger/google-blogger.module'
import { StorageModule } from './storage/storage.module'
import { GoogleBlogModule } from './google-blog/google-blog.module'

@Module({
  imports: [GoogleOauthModule, GoogleBloggerModule, StorageModule, GoogleBlogModule],
  exports: [GoogleOauthModule, GoogleBloggerModule, StorageModule, GoogleBlogModule],
})
export class GoogleModule {}
