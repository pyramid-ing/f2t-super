import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { JobProcessor, JobResult, JobTargetType } from '../job.types'
import { Job } from '@prisma/client'
import { CoupangBlogPostJobService } from './coupang-blog-post-job.service'

@Injectable()
export class CoupangBlogPostJobProcessor implements JobProcessor {
  private readonly logger = new Logger(CoupangBlogPostJobProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupangBlogPostJobService: CoupangBlogPostJobService,
  ) {}

  canProcess(job: Job): boolean {
    return job.targetType === JobTargetType.COUPANG_REVIEW_POSTING
  }

  /**
   * JobProcessor 인터페이스 구현
   */
  async process(jobId: string): Promise<JobResult> {
    try {
      const result = await this.coupangBlogPostJobService.processCoupangPostJob(jobId)

      return {
        resultUrl: result.resultUrl,
        resultMsg: result.resultMsg,
      }
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 처리 실패:', error)
      throw error
    }
  }
}
