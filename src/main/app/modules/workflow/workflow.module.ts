import { Module } from '@nestjs/common'
import { TopicWorkflowController } from './/topic-workflow.controller'
import { TopicWorkflowService } from './topic-workflow.service'
import { CoupangBlogPostWorkflowController } from './coupang-blog-post-workflow.controller'
import { CoupangBlogPostWorkflowService } from './coupang-blog-post-workflow.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { InfoBlogPostJobModule } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.module'
import { CoupangCrawlerModule } from '../coupang-crawler/coupang-crawler.module'
import { CoupangBlogPostJobModule } from '../job/coupang-blog-post-job/coupang-blog-post-job.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { TopicModule } from '@main/app/modules/job/topic-job/topic.module'
import { InfoBlogPostWorkflowController } from './info-blog-post-workflow.controller'
import { InfoBlogPostWorkflowService } from './info-blog-post-workflow.service'
import { AgodaBlogPostWorkflowController } from './agoda-blog-post-workflow.controller'
import { AgodaBlogPostWorkflowService } from './agoda-blog-post-workflow.service'
import { AgodaBlogPostJobModule } from '../job/agoda-blog-post-job/agoda-blog-post-job.module'
import { AgodaCrawlerModule } from '../agoda-crawler/agoda-crawler.module'

@Module({
  imports: [
    CommonModule,
    TopicModule,
    InfoBlogPostJobModule,
    CoupangCrawlerModule,
    CoupangBlogPostJobModule,
    AgodaCrawlerModule,
    AgodaBlogPostJobModule,
    SettingsModule,
  ],
  controllers: [
    TopicWorkflowController,
    InfoBlogPostWorkflowController,
    CoupangBlogPostWorkflowController,
    AgodaBlogPostWorkflowController,
  ],
  providers: [
    TopicWorkflowService,
    InfoBlogPostWorkflowService,
    CoupangBlogPostWorkflowService,
    AgodaBlogPostWorkflowService,
  ],
  exports: [
    TopicWorkflowService,
    InfoBlogPostWorkflowService,
    CoupangBlogPostWorkflowService,
    AgodaBlogPostWorkflowService,
  ],
})
export class WorkflowModule {}
