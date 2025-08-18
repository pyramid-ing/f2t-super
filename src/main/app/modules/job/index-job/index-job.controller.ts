import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { IndexJobService } from './index-job.service'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

@Controller('index-job')
@UseGuards(AuthGuard)
export class IndexJobController {
  constructor(private readonly indexJobService: IndexJobService) {}

  @Post('bulk')
  @Permissions(Permission.USE_INDEXING)
  async createBulk(
    @Body()
    dto: {
      urls: string[]
    },
  ) {
    return this.indexJobService.createBulk(dto)
  }

  @Get('status')
  @Permissions(Permission.USE_INDEXING)
  async status(@Query('url') url: string) {
    return this.indexJobService.getStatusByUrl(url)
  }

  @Get('detail')
  @Permissions(Permission.USE_INDEXING)
  async detail(@Query('url') url: string) {
    return this.indexJobService.getDetailsByUrl(url)
  }
}
