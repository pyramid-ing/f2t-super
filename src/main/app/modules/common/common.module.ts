import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { BrowserErrorHandler } from '@main/app/utils/browser-error-handler'

@Module({
  imports: [PrismaModule],
  providers: [BrowserErrorHandler],
  exports: [PrismaModule, BrowserErrorHandler],
})
export class CommonModule {}
