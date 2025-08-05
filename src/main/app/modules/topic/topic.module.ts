import { Module } from '@nestjs/common'
import { TopicService } from './topic.service'
import { SettingsModule } from '../settings/settings.module'
import { TopicJobService } from './topic-job.service'
import { TopicJobProcessor } from './topic-job.processor'
import { AIModule } from '@main/app/modules/ai/ai.module'
import { TopicJobController } from './topic-job.controller'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'

@Module({
  imports: [SettingsModule, AIModule, JobLogsModule],
  providers: [TopicService, TopicJobService, TopicJobProcessor],
  exports: [TopicService, TopicJobService, TopicJobProcessor],
  controllers: [TopicJobController],
})
export class TopicModule {}
