import { Module } from '@nestjs/common'
import { SearxngService } from './searxng.service'

@Module({
  providers: [SearxngService],
  exports: [SearxngService],
})
export class SearchModule {}
