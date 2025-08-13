import { Module } from '@nestjs/common'
import { InfoBlogPostJobService } from 'src/main/app/modules/job/info-blog-post-job/info-blog-post-job.service'
import { InfoBlogPostJobProcessor } from 'src/main/app/modules/job/info-blog-post-job/info-blog-post-job.processor'
import { AIModule } from '../../ai/ai.module'
import { UtilModule } from '../../util/util.module'
import { StorageModule } from '../../google/storage/storage.module'
import { TistoryModule } from '../../tistory/tistory.module'
import { GoogleBloggerModule } from '@main/app/modules/google/blogger/google-blogger.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'
import { WordPressModule } from '@main/app/modules/wordpress/wordpress.module'
import { SearchModule } from '@main/app/modules/search/search.module'
import { ImagePixabayModule } from '@main/app/modules/image-pixabay/image-pixabay.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [
    AIModule,
    TistoryModule,
    WordPressModule,
    GoogleBloggerModule,
    JobLogsModule,
    StorageModule,
    UtilModule,
    SearchModule,
    SettingsModule,
    ImagePixabayModule,
  ],
  providers: [InfoBlogPostJobService, InfoBlogPostJobProcessor],
  exports: [InfoBlogPostJobService, InfoBlogPostJobProcessor],
})
export class InfoBlogPostJobModule {}
