import { Controller, Get, Param } from '@nestjs/common'
import { JobLogsService } from './job-logs.service'

@Controller('/logs')
export class JobLogsController {
  constructor(private readonly jobLogsService: JobLogsService) {}

  @Get('/:jobId')
  async getLogs(@Param('jobId') jobId: string) {
    return this.jobLogsService.getJobLogs(jobId)
  }

  @Get('/:jobId/latest')
  async getLatestLog(@Param('jobId') jobId: string) {
    return this.jobLogsService.getLatestJobLog(jobId)
  }
}
