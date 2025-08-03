import { Module } from '@nestjs/common'
import { GeminiService } from './gemini.service'
import { CommonModule } from '../common/common.module'
import { AIFactory } from './ai.factory'
import { SettingsModule } from '../settings/settings.module'
import { AIController } from './ai.controller'
import { StorageModule } from '../google/storage/storage.module'
import { UtilModule } from '@main/app/modules/util/util.module'

@Module({
  imports: [CommonModule, UtilModule, SettingsModule, StorageModule],
  providers: [GeminiService, AIFactory],
  exports: [GeminiService, AIFactory],
  controllers: [AIController],
})
export class AIModule {}
