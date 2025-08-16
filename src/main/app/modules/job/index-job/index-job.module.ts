import { Module } from '@nestjs/common'
import { PrismaModule } from '@main/app/modules/common/prisma/prisma.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'
import { HttpModule } from '@nestjs/axios'
import { IndexJobService } from './index-job.service'
import { IndexJobController } from './index-job.controller'
import { IndexJobProcessor } from './index-job.processor'
import { GoogleAuthModule } from '@main/app/modules/google/auth/google-auth.module'
import { GoogleIndexerModule } from '@main/app/modules/google/indexer/google-indexer.module'
import { BingIndexerModule } from '@main/app/modules/bing-indexer/bing-indexer.module'
import { NaverIndexerModule } from '@main/app/modules/naver-indexer/naver-indexer.module'
import { DaumIndexerModule } from '@main/app/modules/daum-indexer/daum-indexer.module'
import { SiteConfigModule } from '@main/app/modules/site-config/site-config.module'

@Module({
  imports: [
    PrismaModule,
    JobLogsModule,
    HttpModule,
    GoogleAuthModule,
    BingIndexerModule,
    DaumIndexerModule,
    NaverIndexerModule,
    GoogleIndexerModule,
    SiteConfigModule,
  ],
  providers: [IndexJobService, IndexJobProcessor],
  controllers: [IndexJobController],
  exports: [IndexJobProcessor, IndexJobService],
})
export class IndexJobModule {}
