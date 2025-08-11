import {
  Controller,
  Get,
  Post,
  Logger,
  Query,
  Res,
  ParseIntPipe,
  DefaultValuePipe,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import * as XLSX from 'xlsx'
import { TopicJobService } from '../topic/topic-job.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { InfoBlogPostJobService } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.service'
import { BlogPostExcelRow } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.types'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

@Controller('workflow')
@UseGuards(AuthGuard)
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name)

  constructor(
    private readonly topicJobService: TopicJobService,
    private readonly infoBlogPostJobService: InfoBlogPostJobService,
  ) {}

  /**
   * SEO 최적화된 주제 찾기 및 엑셀 다운로드
   * GET /workflow/find-topics?topic=소상공인&limit=10
   */
  @Get('find-topics')
  @Permissions(Permission.USE_INFO_POSTING)
  async findTopics(
    @Query('topic') topic: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Res() res: Response,
  ): Promise<void> {
    if (!topic) {
      throw new CustomHttpException(ErrorCode.WORKFLOW_TOPIC_REQUIRED, {
        message: '주제(topic) 파라미터는 필수입니다.',
      })
    }

    // 1. 토픽 생성 job 등록
    const job = await this.topicJobService.createTopicJob(topic, limit)

    // 2. 등록된 jobId 반환 (즉시 결과가 아닌, jobId로 상태/결과를 polling)
    res.status(202).json({
      success: true,
      message: '토픽 생성 작업이 등록되었습니다.',
      jobId: job.id,
    })
  }

  /**
   * 워크플로우 등록
   * POST /workflow/post
   */
  @Post('post')
  @Permissions(Permission.USE_INFO_POSTING)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndQueue(@UploadedFile() file: Express.Multer.File, @Res() res: Response): Promise<void> {
    if (!file)
      throw new CustomHttpException(ErrorCode.WORKFLOW_EXCEL_FILE_REQUIRED, { message: '엑셀 파일은 필수입니다.' })

    // 날짜 형식을 문자열로 유지하기 위한 옵션 설정
    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
      cellDates: false,
      dateNF: 'yyyy-mm-dd hh:mm',
      raw: true,
    })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    // 한글 헤더 기반으로 객체 파싱
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      dateNF: 'yyyy-mm-dd hh:mm',
    }) as BlogPostExcelRow[]

    // BlogPostJobService로 위임
    const jobs = await this.infoBlogPostJobService.createJobsFromExcelRows(data)

    this.logger.log(`✅ 총 ${jobs.length}건의 포스트 작업이 Job Queue에 등록됨`)

    res.status(201).json({
      success: true,
      message: `${jobs.length}건 등록 완료`,
      jobIds: jobs.map(job => job.id),
    })
  }
}
