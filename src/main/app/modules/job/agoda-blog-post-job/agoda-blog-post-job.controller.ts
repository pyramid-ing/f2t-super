import { Controller, Get, Post, Put, Delete, Body, Param, Query, Logger } from '@nestjs/common'
import { AgodaBlogPostJobService } from './agoda-blog-post-job.service'
import { AgodaBlogPostJobResponse, AgodaBlogPostJobStatus } from './agoda-blog-post-job.types'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { CreateAgodaBlogPostJobDto, UpdateAgodaBlogPostJobDto } from '@main/app/modules/job/agoda-blog-post-job/dto'

@Controller('api/agoda-blog-post-jobs')
export class AgodaBlogPostJobController {
  private readonly logger = new Logger(AgodaBlogPostJobController.name)

  constructor(private readonly agodaBlogPostJobService: AgodaBlogPostJobService) {}

  /**
   * AgodaBlogPostJob 생성
   */
  @Post()
  async createAgodaBlogPostJob(@Body() createDto: CreateAgodaBlogPostJobDto): Promise<AgodaBlogPostJobResponse> {
    try {
      return await this.agodaBlogPostJobService.createAgodaBlogPostJob(createDto)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 조회
   */
  @Get(':jobId')
  async getAgodaBlogPostJob(@Param('jobId') jobId: string): Promise<AgodaBlogPostJobResponse | null> {
    try {
      return await this.agodaBlogPostJobService.getAgodaBlogPostJob(jobId)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 목록 조회
   */
  @Get()
  async getAgodaBlogPostJobs(@Query('status') status?: AgodaBlogPostJobStatus): Promise<AgodaBlogPostJobResponse[]> {
    try {
      return await this.agodaBlogPostJobService.getAgodaBlogPostJobs(status)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 업데이트
   */
  @Put(':jobId')
  async updateAgodaBlogPostJob(
    @Param('jobId') jobId: string,
    @Body() updateDto: UpdateAgodaBlogPostJobDto,
  ): Promise<AgodaBlogPostJobResponse> {
    try {
      return await this.agodaBlogPostJobService.updateAgodaBlogPostJob(jobId, updateDto)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 삭제
   */
  @Delete(':jobId')
  async deleteAgodaBlogPostJob(@Param('jobId') jobId: string): Promise<void> {
    try {
      await this.agodaBlogPostJobService.deleteAgodaBlogPostJob(jobId)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_DELETE_FAILED)
    }
  }

  /**
   * AgodaBlogPostJob 상태 업데이트
   */
  @Put(':jobId/status')
  async updateAgodaBlogPostJobStatus(
    @Param('jobId') jobId: string,
    @Body('status') status: AgodaBlogPostJobStatus,
  ): Promise<AgodaBlogPostJobResponse> {
    try {
      return await this.agodaBlogPostJobService.updateAgodaBlogPostJobStatus(jobId, status)
    } catch (error) {
      this.logger.error('AgodaBlogPostJob 상태 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }
}
