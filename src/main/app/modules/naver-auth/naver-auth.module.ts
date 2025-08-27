import { Module } from '@nestjs/common'
import { NaverAuthService } from './naver-auth.service'
import { AiCaptchaSolverService } from '@main/app/modules/naver-auth/ai-captcha-solver.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  providers: [
    NaverAuthService,
    AiCaptchaSolverService,
    {
      provide: 'CAPTCHA_SOLVER',
      useClass: AiCaptchaSolverService,
    },
  ],
  exports: [NaverAuthService],
})
export class NaverAuthModule {}
