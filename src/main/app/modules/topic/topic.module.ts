import { Module } from '@nestjs/common'
import { TopicService } from './topic.service'
import { SettingsModule } from '../settings/settings.module'
import { TopicJobService } from './topic-job.service'
import { AIModule } from '@main/app/modules/ai/ai.module'
import { TopicJobController } from './topic-job.controller'
import { JobLogsModule } from '../job-logs/job-logs.module'

@Module({
  imports: [SettingsModule, AIModule, JobLogsModule],
  providers: [TopicService, TopicJobService],
  exports: [TopicService, TopicJobService],
  controllers: [TopicJobController],
})
export class TopicModule {}
