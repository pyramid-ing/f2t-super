import { Controller, Get, Logger, Query, Res, ParseIntPipe, DefaultValuePipe, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'
import { TopicWorkflowService } from './topic-workflow.service'

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
  public async findTopics(
    @Query('topic') topic: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('immediateRequest') immediateRequest: string | boolean,
    @Res() res: Response,
  ): Promise<void> {
    if (!topic) {
      throw new CustomHttpException(ErrorCode.WORKFLOW_TOPIC_REQUIRED, {
        message: '주제(topic-job) 파라미터는 필수입니다.',
      })
    }

    // 워크플로우 서비스로 비즈니스 로직 위임
    const result = await this.topicWorkflowService.processFindTopics(topic, limit, immediateRequest)

    // 등록된 jobId 반환 (즉시 결과가 아닌, jobId로 상태/결과를 polling)
    res.status(202).json(result)
  }
}
