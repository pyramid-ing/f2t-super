import { Injectable, Logger } from '@nestjs/common'
import { JobProcessor, JobResult, JobTargetType } from '../job.types'
import { Job } from '@prisma/client'
import { AgodaBlogPostJobService } from './agoda-blog-post-job.service'

@Injectable()
export class AgodaBlogPostJobProcessor implements JobProcessor {
  private readonly logger = new Logger(AgodaBlogPostJobProcessor.name)

  constructor(private readonly agodaBlogPostJobService: AgodaBlogPostJobService) {}

  canProcess(job: Job): boolean {
    return job.targetType === JobTargetType.AGODA_POSTING
  }

  /**
   * JobProcessor 인터페이스 구현
   */
  public async process(jobId: string): Promise<JobResult> {
    const result = await this.agodaBlogPostJobService.processJob(jobId)

    return {
      resultUrl: result.resultUrl,
      resultMsg: result.resultMsg,
    }
  }
}
