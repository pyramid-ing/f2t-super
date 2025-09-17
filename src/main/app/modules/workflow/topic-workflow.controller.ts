import { Controller, Get, Logger, Query, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'
import { TopicWorkflowService } from './topic-workflow.service'
import { FindTopicsDto } from './dto/topic-workflow.dto'

@Controller('workflow/topic')
@UseGuards(AuthGuard)
export class TopicWorkflowController {
  private readonly logger = new Logger(TopicWorkflowController.name)

  constructor(private readonly topicWorkflowService: TopicWorkflowService) {}

  /**
   * SEO 최적화된 주제 찾기 및 엑셀 다운로드
   * GET /workflow/find-topics?topic-job=소상공인&limit=10
   */
  @Get('find-topics')
  @Permissions(Permission.USE_INFO_POSTING)
  public async findTopics(@Query() query: FindTopicsDto, @Res() res: Response): Promise<void> {
    // 워크플로우 서비스로 비즈니스 로직 위임
    const result = await this.topicWorkflowService.processFindTopics(query.topic, query.limit, query.immediateRequest)

    // 등록된 jobId 반환 (즉시 결과가 아닌, jobId로 상태/결과를 polling)
    res.status(202).json({
      success: true,
      message: '주제 찾기 작업이 등록되었습니다.',
      data: {
        jobId: result.jobId || '',
        topic: query.topic,
        limit: query.limit,
        status: 'pending',
        estimatedTime: '5-10분',
      },
    })
  }
}
