import { Module } from '@nestjs/common'
import { ImagePixabayService } from 'src/main/app/modules/media/image-pixabay.service'
import { SettingsModule } from '../settings/settings.module'
import { AIModule } from '../ai/ai.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { GoogleModule } from '../google/google.module'

@Module({
  imports: [SettingsModule, AIModule, CommonModule, GoogleModule],
  controllers: [],
  providers: [ImagePixabayService],
  exports: [ImagePixabayService],
})
export class MediaModule {}
