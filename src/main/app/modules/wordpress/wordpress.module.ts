import { Module } from '@nestjs/common'
import { WordPressController } from './wordpress.controller'
import { WordPressService } from './wordpress.service'
import { WordPressAccountService } from './wordpress-account.service'
import { WordPressApiService } from './wordpress-api.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [WordPressController],
  providers: [WordPressService, WordPressAccountService, WordPressApiService],
  exports: [WordPressService, WordPressAccountService, WordPressApiService],
})
export class WordPressModule {}
