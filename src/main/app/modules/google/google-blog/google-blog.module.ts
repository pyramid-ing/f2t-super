import { Module } from '@nestjs/common'
import { GoogleBlogController } from './google-blog.controller'
import { GoogleBlogService } from './google-blog.service'
import { CommonModule } from '../../common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [CommonModule, SettingsModule],
  controllers: [GoogleBlogController],
  providers: [GoogleBlogService],
  exports: [GoogleBlogService],
})
export class GoogleBlogModule {}
