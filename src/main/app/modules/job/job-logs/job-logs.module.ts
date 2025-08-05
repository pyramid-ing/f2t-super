import { Module } from '@nestjs/common'
import { JobLogsController } from './job-logs.controller'
import { JobLogsService } from './job-logs.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [JobLogsController],
  providers: [JobLogsService],
  exports: [JobLogsService],
})
export class JobLogsModule {}
