import { Module } from '@nestjs/common'
import { JobController } from './job.controller'
import { JobQueueProcessor } from './job-queue.processor'
import { PrismaModule } from '../common/prisma/prisma.module'
import { BlogPostJobModule } from './blog-post-job/blog-post-job.module'
import { CoupangBlogPostJobModule } from './coupang-blog-post-job/coupang-blog-post-job.module'
import { ScheduleModule } from '@nestjs/schedule'
import { TopicModule } from '@main/app/modules/topic/topic.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    BlogPostJobModule,
    CoupangBlogPostJobModule,
    TopicModule,
    JobLogsModule,
  ],
  controllers: [JobController],
  providers: [JobQueueProcessor],
  exports: [BlogPostJobModule, CoupangBlogPostJobModule],
})
export class JobModule {}
