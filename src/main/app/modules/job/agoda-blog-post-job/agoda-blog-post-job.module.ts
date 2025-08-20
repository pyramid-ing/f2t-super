import { Module } from '@nestjs/common'
import { AgodaBlogPostJobController } from './agoda-blog-post-job.controller'
import { AgodaBlogPostJobService } from './agoda-blog-post-job.service'
import { AgodaBlogPostJobProcessor } from '@main/app/modules/job/agoda-blog-post-job/agoda-blog-post-job.processor'
import { AgodaCrawlerModule } from '../../agoda-crawler/agoda-crawler.module'
import { AgodaPartnersModule } from '../../agoda-partners/agoda-partners.module'
import { AIModule } from '../../ai/ai.module'
import { TistoryModule } from '@main/app/modules/tistory/tistory.module'
import { WordPressModule } from '@main/app/modules/wordpress/wordpress.module'
import { GoogleBloggerModule } from '@main/app/modules/google/blogger/google-blogger.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'
import { StorageModule } from '@main/app/modules/google/storage/storage.module'
import { UtilModule } from '@main/app/modules/util/util.module'

@Module({
  imports: [
    AgodaCrawlerModule,
    AgodaPartnersModule,
    AIModule,
    TistoryModule,
    WordPressModule,
    GoogleBloggerModule,
    JobLogsModule,
    StorageModule,
    UtilModule,
  ],
  controllers: [AgodaBlogPostJobController],
  providers: [AgodaBlogPostJobService, AgodaBlogPostJobProcessor],
  exports: [AgodaBlogPostJobService, AgodaBlogPostJobProcessor],
})
export class AgodaBlogPostJobModule {}
