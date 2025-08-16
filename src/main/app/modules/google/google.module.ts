import { Module } from '@nestjs/common'
import { GoogleOauthModule } from 'src/main/app/modules/google/oauth/google-oauth.module'
import { GoogleBloggerModule } from '@main/app/modules/google/blogger/google-blogger.module'
import { StorageModule } from './storage/storage.module'
import { GoogleBlogModule } from './google-blog/google-blog.module'
import { HttpModule } from '@nestjs/axios'
import { PrismaModule } from '@main/app/modules/common/prisma/prisma.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { GoogleIndexerModule } from '@main/app/modules/google/indexer/google-indexer.module'
import { GoogleAuthModule } from '@main/app/modules/google/auth/google-auth.module'

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    JobLogsModule,
    SettingsModule,
    GoogleOauthModule,
    GoogleBloggerModule,
    StorageModule,
    GoogleBlogModule,
    GoogleIndexerModule,
    GoogleAuthModule,
  ],
  providers: [],
  exports: [
    GoogleOauthModule,
    GoogleBloggerModule,
    StorageModule,
    GoogleBlogModule,
    GoogleIndexerModule,
    GoogleAuthModule,
  ],
})
export class GoogleModule {}
