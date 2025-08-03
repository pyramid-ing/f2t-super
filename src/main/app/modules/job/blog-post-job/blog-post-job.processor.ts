import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobProcessor, JobResult, JobTargetType } from '@main/app/modules/job/job.types'
import { Job } from '@prisma/client'
import { BlogPostJobService } from './blog-post-job.service'

@Injectable()
export class BlogPostJobProcessor implements JobProcessor {
  private readonly logger = new Logger(BlogPostJobProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly blogPostJobService: BlogPostJobService,
  ) {}

  canProcess(job: Job): boolean {
    return job.targetType === JobTargetType.BLOG_INFO_POSTING
  }

  /**
   * JobProcessor 인터페이스 구현
   */
  async process(jobId: string): Promise<JobResult> {
    try {
      const result = await this.blogPostJobService.processBlogPostJob(jobId)

      return {
        resultUrl: result.resultUrl,
        resultMsg: result.resultMsg,
      }
    } catch (error) {
      this.logger.error('BlogPostJob 처리 실패:', error)
      throw error
    }
  }
}
