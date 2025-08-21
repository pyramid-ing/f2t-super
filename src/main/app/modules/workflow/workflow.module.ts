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
import { AgodaBlogPostWorkflowController } from './agoda-blog-post-workflow.controller'
import { AgodaBlogPostWorkflowService } from './agoda-blog-post-workflow.service'
import { AgodaBlogPostJobModule } from '../job/agoda-blog-post-job/agoda-blog-post-job.module'

@Module({
  imports: [
    CommonModule,
    TopicModule,
    InfoBlogPostJobModule,
    CoupangCrawlerModule,
    CoupangBlogPostJobModule,
    AgodaBlogPostJobModule,
    SettingsModule,
  ],
  controllers: [
    TopicWorkflowController,
    InfoBlogPostWorkflowController,
    CoupangBlogPostWorkflowController,
    AgodaBlogPostWorkflowController,
  ],
  providers: [CoupangBlogPostWorkflowService, AgodaBlogPostWorkflowService],
  exports: [CoupangBlogPostWorkflowService, AgodaBlogPostWorkflowService],
})
export class WorkflowModule {}
