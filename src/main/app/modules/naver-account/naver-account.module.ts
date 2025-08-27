import { Module } from '@nestjs/common'
import { NaverAccountController } from './naver-account.controller'
import { NaverAccountService } from './naver-account.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { NaverAuthModule } from '../naver-auth/naver-auth.module'

@Module({
  imports: [CommonModule, NaverAuthModule],
  controllers: [NaverAccountController],
  providers: [NaverAccountService],
  exports: [NaverAccountService],
})
export class NaverAccountModule {}
