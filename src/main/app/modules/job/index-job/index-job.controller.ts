import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { IndexJobService } from './index-job.service'

@Controller('index-job')
export class IndexJobController {
  constructor(private readonly indexJobService: IndexJobService) {}

  @Post()
  async create(@Body() dto: { url: string }) {
    return this.indexJobService.create(dto)
  }

  @Get('status')
  async status(@Query('url') url: string) {
    return this.indexJobService.getStatusByUrl(url)
  }
}
