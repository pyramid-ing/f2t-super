import { Module } from '@nestjs/common'
import { InfoBlogPostJobService } from 'src/main/app/modules/job/info-blog-post-job/info-blog-post-job.service'
import { InfoBlogPostJobProcessor } from 'src/main/app/modules/job/info-blog-post-job/info-blog-post-job.processor'
import { CommonModule } from '../../common/common.module'
import { AIModule } from '../../ai/ai.module'
import { UtilModule } from '../../util/util.module'
import { PublishModule } from '../../publish/publish.module'
import { ContentGenerateModule } from '../../content-generate/content-generate.module'
import { StorageModule } from '../../google/storage/storage.module'
import { GoogleBlogModule } from '../../google/google-blog/google-blog.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { TistoryModule } from '../../tistory/tistory.module'
import { GoogleBloggerModule } from '@main/app/modules/google/blogger/google-blogger.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'

@Module({
  imports: [
    CommonModule,
    AIModule,
    UtilModule,
    PublishModule,
    ContentGenerateModule,
    JobLogsModule,
    StorageModule,
    SettingsModule,
    GoogleBlogModule,
    GoogleBloggerModule,
    TistoryModule,
  ],
  providers: [InfoBlogPostJobService, InfoBlogPostJobProcessor],
  exports: [InfoBlogPostJobService, InfoBlogPostJobProcessor],
})
export class InfoBlogPostJobModule {}
