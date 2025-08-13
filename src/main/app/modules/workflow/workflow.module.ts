import { Module } from '@nestjs/common'
import { TopicWorkflowController } from './/topic-workflow.controller'
import { CoupangBlogPostWorkflowController } from './coupang-blog-post-workflow.controller'
import { CoupangBlogPostWorkflowService } from './coupang-blog-post-workflow.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { InfoBlogPostJobModule } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.module'
import { CoupangCrawlerModule } from '../coupang-crawler/coupang-crawler.module'
import { CoupangBlogPostJobModule } from '../job/coupang-blog-post-job/coupang-blog-post-job.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { TopicModule } from '@main/app/modules/job/topic-job/topic.module'
import { InfoBlogPostWorkflowController } from './info-blog-post-workflow.controller'

@Module({
  imports: [
    CommonModule,
    TopicModule,
    InfoBlogPostJobModule,
    CoupangCrawlerModule,
    CoupangBlogPostJobModule,
    SettingsModule,
  ],
  controllers: [TopicWorkflowController, InfoBlogPostWorkflowController, CoupangBlogPostWorkflowController],
  providers: [CoupangBlogPostWorkflowService],
  exports: [CoupangBlogPostWorkflowService],
})
export class WorkflowModule {}
