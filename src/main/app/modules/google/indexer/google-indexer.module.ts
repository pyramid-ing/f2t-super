import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { GoogleIndexerService } from './google-indexer.service'
import { SiteConfigModule } from '@main/app/modules/site-config/site-config.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'
import { GoogleAuthModule } from '@main/app/modules/google/auth/google-auth.module'

@Module({
  imports: [HttpModule, SiteConfigModule, CommonModule, JobLogsModule, SettingsModule, GoogleAuthModule],
  controllers: [],
  providers: [GoogleIndexerService],
  exports: [GoogleIndexerService],
})
export class GoogleIndexerModule {}
