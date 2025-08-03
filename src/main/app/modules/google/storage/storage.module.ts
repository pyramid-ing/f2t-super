import { Module } from '@nestjs/common'
import { StorageService } from './storage.service'
import { SettingsModule } from '../../settings/settings.module'
import { StorageController } from 'src/main/app/modules/google/storage/storage.controller'

@Module({
  imports: [SettingsModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
