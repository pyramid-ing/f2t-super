import { Module } from '@nestjs/common'
import { WorkflowController } from './workflow.controller'
import { CommonModule } from '@main/app/modules/common/common.module'
import { TopicModule } from '@main/app/modules/topic/topic.module'
import { BlogPostJobModule } from '../job/blog-post-job/blog-post-job.module'

@Module({
  imports: [CommonModule, TopicModule, BlogPostJobModule],
  controllers: [WorkflowController],
})
export class WorkflowModule {}
