import { Controller, Get, Post, Put, Delete, Body, Param, Query, Logger } from '@nestjs/common'
import { AgodaBlogPostJobCrudService } from './agoda-blog-post-job.crud.service'
import { AgodaBlogPostJobResponse, AgodaBlogPostJobStatus } from './agoda-blog-post-job.types'
import { CreateAgodaBlogPostJobDto, UpdateAgodaBlogPostJobDto } from '@main/app/modules/job/agoda-blog-post-job/dto'

@Controller('api/agoda-blog-post-jobs')
export class AgodaBlogPostJobController {
  private readonly logger = new Logger(AgodaBlogPostJobController.name)

  constructor(private readonly agodaBlogPostJobCrudService: AgodaBlogPostJobCrudService) {}

  /**
   * AgodaBlogPostJob 생성
   */
  @Post()
  async createAgodaBlogPostJob(@Body() createDto: CreateAgodaBlogPostJobDto): Promise<AgodaBlogPostJobResponse> {
    return await this.agodaBlogPostJobCrudService.createAgodaBlogPostJob(createDto)
  }

  /**
   * AgodaBlogPostJob 조회
   */
  @Get(':jobId')
  async getAgodaBlogPostJob(@Param('jobId') jobId: string): Promise<AgodaBlogPostJobResponse | null> {
    return await this.agodaBlogPostJobCrudService.getAgodaBlogPostJob(jobId)
  }

  /**
   * AgodaBlogPostJob 목록 조회
   */
  @Get()
  async getAgodaBlogPostJobs(@Query('status') status?: AgodaBlogPostJobStatus): Promise<AgodaBlogPostJobResponse[]> {
    return await this.agodaBlogPostJobCrudService.getAgodaBlogPostJobs(status)
  }

  /**
   * AgodaBlogPostJob 업데이트
   */
  @Put(':jobId')
  async updateAgodaBlogPostJob(
    @Param('jobId') jobId: string,
    @Body() updateDto: UpdateAgodaBlogPostJobDto,
  ): Promise<AgodaBlogPostJobResponse> {
    return await this.agodaBlogPostJobCrudService.updateAgodaBlogPostJob(jobId, updateDto)
  }

  /**
   * AgodaBlogPostJob 삭제
   */
  @Delete(':jobId')
  async deleteAgodaBlogPostJob(@Param('jobId') jobId: string): Promise<void> {
    await this.agodaBlogPostJobCrudService.deleteAgodaBlogPostJob(jobId)
  }

  /**
   * AgodaBlogPostJob 상태 업데이트
   */
  @Put(':jobId/status')
  async updateAgodaBlogPostJobStatus(
    @Param('jobId') jobId: string,
    @Body('status') status: AgodaBlogPostJobStatus,
  ): Promise<AgodaBlogPostJobResponse> {
    return await this.agodaBlogPostJobCrudService.updateAgodaBlogPostJobStatus(jobId, status)
  }
}
