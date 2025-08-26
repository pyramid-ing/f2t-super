import { Body, Controller, Get, Post, Query, UseGuards, ParseIntPipe } from '@nestjs/common'
import { IndexJobService } from './index-job.service'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'
import { IndexProvider, IndexStatus } from '@main/app/modules/job/job.types'

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

  @Get('indexes')
  @Permissions(Permission.USE_INDEXING)
  async listIndexes(
    @Query('q') q?: string,
    @Query('status') status?: IndexStatus,
    @Query('provider') provider?: IndexProvider,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 20,
  ) {
    return this.indexJobService.listIndexes({ q, status, provider, page, pageSize })
  }

  @Get('indexes-by-job')
  @Permissions(Permission.USE_INDEXING)
  async listIndexesByJob(
    @Query('jobId') jobId: string,
    @Query('q') q?: string,
    @Query('status') status?: IndexStatus,
    @Query('provider') provider?: IndexProvider,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 50,
  ) {
    return this.indexJobService.listIndexesByJobId({ jobId, q, status, provider, page, pageSize })
  }
}
