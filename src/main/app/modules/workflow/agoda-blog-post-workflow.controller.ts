import { Controller, Post, Body, Res, Logger, Get, Query } from '@nestjs/common'
import { Response } from 'express'
import { AgodaBlogPostWorkflowService } from './agoda-blog-post-workflow.service'
import { CreateAgodaBlogPostDto, SearchAgodaDto } from './dto/agoda-blog-post-workflow.dto'

@Controller('workflow/agoda-blog-post')
export class AgodaBlogPostWorkflowController {
  private readonly logger = new Logger(AgodaBlogPostWorkflowController.name)

  constructor(private readonly agodaWorkflow: AgodaBlogPostWorkflowService) {}

  // 수동 입력: 단일 또는 줄바꿈 다건 URL → 비교형 처리
  @Post()
  public async create(@Body() data: CreateAgodaBlogPostDto, @Res() res: Response): Promise<void> {
    const result = await this.agodaWorkflow.createFromManualInput(data)
    res.status(201).json({ success: true, message: '아고다 작업이 등록되었습니다.', data: result })
  }

  @Get('search')
  public async search(@Query() query: SearchAgodaDto, @Res() res: Response): Promise<void> {
    const results = await this.agodaWorkflow.searchAgoda(query.keyword, query.limit)
    res.status(200).json({ success: true, message: '검색이 완료되었습니다.', data: results })
  }
}
