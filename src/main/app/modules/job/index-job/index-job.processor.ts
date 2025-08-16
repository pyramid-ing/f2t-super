import { Injectable } from '@nestjs/common'
import { Job } from '@prisma/client'
import { JobProcessor } from '@main/app/modules/job/job.types'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { GoogleIndexerService } from '@main/app/modules/google/indexer/google-indexer.service'
import { BingIndexerService } from '@main/app/modules/bing-indexer/bing-indexer.service'
import { NaverIndexerService } from '@main/app/modules/naver-indexer/naver-indexer.service'
import { DaumIndexerService } from '@main/app/modules/daum-indexer/daum-indexer.service'

@Injectable()
export class IndexJobProcessor implements JobProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleIndexer: GoogleIndexerService,
    private readonly bingIndexer: BingIndexerService,
    private readonly naverIndexer: NaverIndexerService,
    private readonly daumIndexer: DaumIndexerService,
  ) {}

  canProcess(job: Job): boolean {
    return job.targetType === 'index'
  }

  async process(jobId: string): Promise<void> {
    const indexJob = await this.prisma.indexJob.findUnique({ where: { jobId }, include: { site: true } })
    if (!indexJob) return

    switch (indexJob.provider.toUpperCase()) {
      case 'GOOGLE':
        await this.googleIndexer.submitUrl(indexJob.siteId, indexJob.url)
        break
      case 'BING':
        await this.bingIndexer.submitUrl(indexJob.siteId, indexJob.url)
        break
      case 'NAVER':
        await this.naverIndexer.submitUrl(indexJob.siteId, indexJob.url)
        break
      case 'DAUM':
        await this.daumIndexer.submitUrl(indexJob.siteId, indexJob.url)
        break
    }
  }
}
