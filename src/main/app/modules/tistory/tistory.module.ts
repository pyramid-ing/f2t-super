import { Module } from '@nestjs/common'
import { TistoryController } from './tistory.controller'
import { TistoryService } from './tistory.service'
import { TistoryAccountService } from './tistory-account.service'
import { TistoryAutomationService } from './tistory-automation.service'
import { PrismaModule } from '../common/prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [TistoryController],
  providers: [TistoryService, TistoryAccountService, TistoryAutomationService],
  exports: [TistoryService, TistoryAccountService, TistoryAutomationService],
})
export class TistoryModule {}
