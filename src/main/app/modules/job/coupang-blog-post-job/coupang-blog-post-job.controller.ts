import { Controller, Get, Post, Put, Delete, Body, Param, Query, Logger } from '@nestjs/common'
import { CoupangBlogPostJobService } from './coupang-blog-post-job.service'
import { CoupangBlogPostJobResponse, CoupangBlogPostJobStatus } from './coupang-blog-post-job.types'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import {
  CreateCoupangBlogPostJobDto,
  UpdateCoupangBlogPostJobDto,
} from '@main/app/modules/job/coupang-blog-post-job/dto'

@Controller('api/coupang-blog-post-jobs')
export class CoupangBlogPostJobController {
  private readonly logger = new Logger(CoupangBlogPostJobController.name)

  constructor(private readonly coupangBlogPostJobService: CoupangBlogPostJobService) {}

  /**
   * CoupangBlogPostJob 생성
   */
  @Post()
  async createCoupangBlogPostJob(@Body() createDto: CreateCoupangBlogPostJobDto): Promise<CoupangBlogPostJobResponse> {
    try {
      return await this.coupangBlogPostJobService.createCoupangBlogPostJob(createDto)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 조회
   */
  @Get(':jobId')
  async getCoupangBlogPostJob(@Param('jobId') jobId: string): Promise<CoupangBlogPostJobResponse | null> {
    try {
      return await this.coupangBlogPostJobService.getCoupangBlogPostJob(jobId)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 목록 조회
   */
  @Get()
  async getCoupangBlogPostJobs(
    @Query('status') status?: CoupangBlogPostJobStatus,
  ): Promise<CoupangBlogPostJobResponse[]> {
    try {
      return await this.coupangBlogPostJobService.getCoupangBlogPostJobs(status)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 업데이트
   */
  @Put(':jobId')
  async updateCoupangBlogPostJob(
    @Param('jobId') jobId: string,
    @Body() updateDto: UpdateCoupangBlogPostJobDto,
  ): Promise<CoupangBlogPostJobResponse> {
    try {
      return await this.coupangBlogPostJobService.updateCoupangBlogPostJob(jobId, updateDto)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 삭제
   */
  @Delete(':jobId')
  async deleteCoupangBlogPostJob(@Param('jobId') jobId: string): Promise<void> {
    try {
      await this.coupangBlogPostJobService.deleteCoupangBlogPostJob(jobId)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_DELETE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 상태 업데이트
   */
  @Put(':jobId/status')
  async updateCoupangBlogPostJobStatus(
    @Param('jobId') jobId: string,
    @Body('status') status: CoupangBlogPostJobStatus,
  ): Promise<CoupangBlogPostJobResponse> {
    try {
      return await this.coupangBlogPostJobService.updateCoupangBlogPostJobStatus(jobId, status)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 상태 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }
}
