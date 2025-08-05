import { Module } from '@nestjs/common'
import { PublishService } from './publish.service'
import { GoogleBloggerModule } from '../google/blogger/google-blogger.module'
import { ContentGenerateModule } from '../content-generate/content-generate.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'

@Module({
  imports: [GoogleBloggerModule, ContentGenerateModule, JobLogsModule],
  providers: [PublishService],
  exports: [PublishService],
})
export class PublishModule {}
