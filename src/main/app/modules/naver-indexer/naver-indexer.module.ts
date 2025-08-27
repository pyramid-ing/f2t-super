import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule } from '@nestjs/config'
import { NaverIndexerService } from './naver-indexer.service'
import { SiteConfigModule } from '@main/app/modules/site-config/site-config.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { NaverAccountModule } from '../naver-account/naver-account.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'
import { NaverAuthModule } from '../naver-auth/naver-auth.module'

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    SiteConfigModule,
    CommonModule,
    JobLogsModule,
    SettingsModule,
    NaverAccountModule,
    NaverAuthModule,
  ],
  controllers: [],
  providers: [NaverIndexerService],
  exports: [NaverIndexerService],
})
export class NaverIndexerModule {}
