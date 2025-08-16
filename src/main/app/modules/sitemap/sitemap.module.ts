import { Module } from '@nestjs/common'
import { SitemapService } from './sitemap.service'
import { SitemapController } from './sitemap.controller'
import { SitemapQueueProcessor } from '@main/app/modules/sitemap/sitemap-queue.processor'
import { PrismaModule } from '../common/prisma/prisma.module'
import { JobModule } from '../job/job.module'
import { IndexJobModule } from '@main/app/modules/job/index-job/index-job.module'

@Module({
  imports: [PrismaModule, JobModule, IndexJobModule],
  controllers: [SitemapController],
  providers: [SitemapService, SitemapQueueProcessor],
  exports: [SitemapService, SitemapQueueProcessor],
})
export class SitemapModule {}
