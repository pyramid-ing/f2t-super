import { Module } from '@nestjs/common'
import { ContentGenerateService } from './content-generate.service'
import { AIModule } from '../ai/ai.module'
import { ImagePixabayModule } from '@main/app/modules/image-pixabay/image-pixabay.module'
import { SettingsModule } from '../settings/settings.module'
import { StorageModule } from '@main/app/modules/google/storage/storage.module'
import { UtilModule } from '../util/util.module'
import { SearchModule } from '../search/search.module'
import { TistoryModule } from '../tistory/tistory.module'
import { JobLogsModule } from '@main/app/modules/job/job-logs/job-logs.module'

@Module({
  imports: [
    AIModule,
    ImagePixabayModule,
    SettingsModule,
    StorageModule,
    JobLogsModule,
    UtilModule,
    SearchModule,
    TistoryModule,
  ],
  providers: [ContentGenerateService],
  exports: [ContentGenerateService],
})
export class ContentGenerateModule {}
