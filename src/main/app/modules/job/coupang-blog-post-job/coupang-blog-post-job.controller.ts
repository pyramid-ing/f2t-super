import { Controller, Get, Post, Put, Delete, Body, Param, Query, Logger } from '@nestjs/common'
import { CoupangBlogPostJobCrudService } from './coupang-blog-post-job.crud.service'
import { CoupangBlogPostJobResponse, CoupangBlogPostJobStatus } from './coupang-blog-post-job.types'
import {
  CreateCoupangBlogPostJobDto,
  UpdateCoupangBlogPostJobDto,
} from '@main/app/modules/job/coupang-blog-post-job/dto'

@Controller('api/coupang-blog-post-jobs')
export class CoupangBlogPostJobController {
  private readonly logger = new Logger(CoupangBlogPostJobController.name)

  constructor(private readonly coupangBlogPostJobCrudService: CoupangBlogPostJobCrudService) {}

  /**
   * CoupangBlogPostJob 생성
   */
  @Post()
  async createCoupangBlogPostJob(@Body() createDto: CreateCoupangBlogPostJobDto): Promise<CoupangBlogPostJobResponse> {
    return await this.coupangBlogPostJobCrudService.createCoupangBlogPostJob(createDto)
  }

  /**
   * CoupangBlogPostJob 조회
   */
  @Get(':jobId')
  async getCoupangBlogPostJob(@Param('jobId') jobId: string): Promise<CoupangBlogPostJobResponse | null> {
    return await this.coupangBlogPostJobCrudService.getCoupangBlogPostJob(jobId)
  }

  /**
   * CoupangBlogPostJob 목록 조회
   */
  @Get()
  async getCoupangBlogPostJobs(
    @Query('status') status?: CoupangBlogPostJobStatus,
  ): Promise<CoupangBlogPostJobResponse[]> {
    return await this.coupangBlogPostJobCrudService.getCoupangBlogPostJobs(status)
  }

  /**
   * CoupangBlogPostJob 업데이트
   */
  @Put(':jobId')
  async updateCoupangBlogPostJob(
    @Param('jobId') jobId: string,
    @Body() updateDto: UpdateCoupangBlogPostJobDto,
  ): Promise<CoupangBlogPostJobResponse> {
    return await this.coupangBlogPostJobCrudService.updateCoupangBlogPostJob(jobId, updateDto)
  }

  /**
   * CoupangBlogPostJob 삭제
   */
  @Delete(':jobId')
  async deleteCoupangBlogPostJob(@Param('jobId') jobId: string): Promise<void> {
    await this.coupangBlogPostJobCrudService.deleteCoupangBlogPostJob(jobId)
  }

  /**
   * CoupangBlogPostJob 상태 업데이트
   */
  @Put(':jobId/status')
  async updateCoupangBlogPostJobStatus(
    @Param('jobId') jobId: string,
    @Body('status') status: CoupangBlogPostJobStatus,
  ): Promise<CoupangBlogPostJobResponse> {
    return await this.coupangBlogPostJobCrudService.updateCoupangBlogPostJobStatus(jobId, status)
  }
}
