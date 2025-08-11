import { Module } from '@nestjs/common'
import { JobController } from './job.controller'
import { JobQueueProcessor } from './job-queue.processor'
import { PrismaModule } from '../common/prisma/prisma.module'
import { InfoBlogPostJobModule } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.module'
import { CoupangBlogPostJobModule } from './coupang-blog-post-job/coupang-blog-post-job.module'
import { ScheduleModule } from '@nestjs/schedule'
import { TopicModule } from '@main/app/modules/topic/topic.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    InfoBlogPostJobModule,
    CoupangBlogPostJobModule,
    TopicModule,
    JobLogsModule,
  ],
  controllers: [JobController],
  providers: [JobQueueProcessor],
  exports: [InfoBlogPostJobModule, CoupangBlogPostJobModule],
})
export class JobModule {}
