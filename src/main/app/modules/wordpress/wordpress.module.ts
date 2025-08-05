import { Module } from '@nestjs/common'
import { WordPressController } from './wordpress.controller'
import { WordPressService } from './wordpress.service'
import { WordPressAccountService } from './wordpress-account.service'
import { WordPressApiService } from './wordpress-api.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [CommonModule, SettingsModule],
  controllers: [WordPressController],
  providers: [WordPressService, WordPressAccountService, WordPressApiService],
  exports: [WordPressService, WordPressAccountService, WordPressApiService],
})
export class WordPressModule {}
