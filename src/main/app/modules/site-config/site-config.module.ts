import { Module } from '@nestjs/common'
import { SiteConfigController } from 'src/main/app/modules/site-config/site-config.controller'
import { SiteConfigService } from 'src/main/app/modules/site-config/site-config.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  providers: [SiteConfigService],
  controllers: [SiteConfigController],
  exports: [SiteConfigService],
})
export class SiteConfigModule {}
