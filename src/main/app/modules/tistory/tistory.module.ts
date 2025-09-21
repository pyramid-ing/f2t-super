import { Module } from '@nestjs/common'
import { TistoryController } from './tistory.controller'
import { TistoryAutomationController } from './tistory-automation.controller'
import { TistoryService } from './tistory.service'
import { TistoryAccountService } from './tistory-account.service'
import { TistoryAutomationService } from './tistory-automation.service'
import { AIModule } from '@main/app/modules/ai/ai.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule, AIModule, SettingsModule],
  controllers: [TistoryController, TistoryAutomationController],
  providers: [TistoryService, TistoryAccountService, TistoryAutomationService],
  exports: [TistoryService, TistoryAccountService, TistoryAutomationService],
})
export class TistoryModule {}
