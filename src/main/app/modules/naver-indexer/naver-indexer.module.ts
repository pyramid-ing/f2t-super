import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule } from '@nestjs/config'
import { NaverIndexerService } from './naver-indexer.service'
import { AiCaptchaSolverService } from './ai-captcha-solver.service'
import { SiteConfigModule } from '@main/app/modules/site-config/site-config.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { NaverAccountModule } from '../naver-account/naver-account.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    SiteConfigModule,
    CommonModule,
    JobLogsModule,
    SettingsModule,
    NaverAccountModule,
  ],
  controllers: [],
  providers: [
    NaverIndexerService,
    AiCaptchaSolverService,
    {
      provide: 'CAPTCHA_SOLVER',
      useClass: AiCaptchaSolverService, // AI 서비스 사용
      // useClass: DefaultCaptchaSolver, // 기본 서비스 사용 (AI 서비스 연동 전)
    },
  ],
  exports: [NaverIndexerService],
})
export class NaverIndexerModule {}
