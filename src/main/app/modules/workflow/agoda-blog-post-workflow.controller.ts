import { Controller, Post, Body, Res, Logger, Get, Query } from '@nestjs/common'
import { Response } from 'express'
import { AgodaBlogPostWorkflowService } from './agoda-blog-post-workflow.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Controller('workflow/agoda-blog-post')
export class AgodaBlogPostWorkflowController {
  private readonly logger = new Logger(AgodaBlogPostWorkflowController.name)

  constructor(private readonly agodaWorkflow: AgodaBlogPostWorkflowService) {}

  // 수동 입력: 단일 또는 줄바꿈 다건 URL → 비교형 처리
  @Post()
  async create(@Body() data: any, @Res() res: Response): Promise<void> {
    try {
      const result = await this.agodaWorkflow.createFromManualInput(data)
      res.status(201).json({ success: true, message: '아고다 작업이 등록되었습니다.', data: result })
    } catch (error) {
      this.logger.error('아고다 워크플로우 등록 실패:', error)
      if (error instanceof CustomHttpException) throw error
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  @Get('search')
  async search(@Query('keyword') keyword: string, @Query('limit') limit = '5', @Res() res: Response): Promise<void> {
    try {
      if (!keyword || !keyword.trim()) {
        throw new CustomHttpException(ErrorCode.INVALID_INPUT, { message: 'keyword는 필수입니다.' })
      }
      const parsed = Math.min(5, Math.max(1, parseInt(limit, 10) || 5))
      const results = await this.agodaWorkflow.searchAgoda(keyword.trim(), parsed)
      res.status(200).json({ success: true, data: results })
    } catch (error) {
      this.logger.error('아고다 검색 실패:', error)
      if (error instanceof CustomHttpException) throw error
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED, { message: '아고다 검색에 실패했습니다.' })
    }
  }
}
