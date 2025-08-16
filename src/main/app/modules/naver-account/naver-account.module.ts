import { Module } from '@nestjs/common'
import { NaverAccountController } from './naver-account.controller'
import { NaverAccountService } from './naver-account.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [NaverAccountController],
  providers: [NaverAccountService],
  exports: [NaverAccountService],
})
export class NaverAccountModule {}
