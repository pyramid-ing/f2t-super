import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { BrowserErrorHandler } from '@main/app/utils/browser-error-handler'
import { UrlUpdateService } from './utils/url-update.service'

@Module({
  imports: [PrismaModule],
  providers: [BrowserErrorHandler, UrlUpdateService],
  exports: [PrismaModule, BrowserErrorHandler, UrlUpdateService],
})
export class CommonModule {}
