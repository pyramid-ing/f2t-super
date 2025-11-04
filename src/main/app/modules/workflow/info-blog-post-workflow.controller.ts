import { Controller, Post, Get, Logger, Res, UploadedFile, UseInterceptors, UseGuards, Body } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { InfoBlogPostWorkflowService } from './info-blog-post-workflow.service'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'
import { UploadInfoBlogPostDto } from './dto/info-blog-post-workflow.dto'

@Controller('workflow/info-blog-post')
@UseGuards(AuthGuard)
export class InfoBlogPostWorkflowController {
  private readonly logger = new Logger(InfoBlogPostWorkflowController.name)

  constructor(private readonly infoBlogPostWorkflowService: InfoBlogPostWorkflowService) {}

  /**
   * 워크플로우 등록
   * POST /workflow/post
   */
  @Post('post')
  @Permissions(Permission.USE_INFO_POSTING)
  @UseInterceptors(FileInterceptor('file'))
  public async uploadAndQueue(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadInfoBlogPostDto,
    @Res() res: Response,
  ): Promise<void> {
    this._validateFile(file)

    // 워크플로우 서비스로 비즈니스 로직 위임
    const result = await this.infoBlogPostWorkflowService.processWorkflow(file, body)

    res.status(201).json({
      success: true,
      message: '정보 블로그 포스트 작업이 등록되었습니다.',
      data: {
        jobId: result.jobIds?.[0] || '',
        totalProcessed: typeof result.totalProcessed === 'number' ? result.totalProcessed : 0,
        success: typeof result.success === 'number' ? result.success : 0,
        failed: 0,
        errors: [],
      },
    })
  }

  /**
   * 정보 블로그 포스트 샘플 엑셀 다운로드
   * GET /workflow/info-blog-post/sample-excel
   */
  @Get('sample-excel')
  @Permissions(Permission.USE_INFO_POSTING)
  public async downloadSampleExcel(@Res() res: Response): Promise<void> {
    this.logger.log('정보 블로그 포스트 샘플 엑셀 생성 시작')

    const buffer = this.infoBlogPostWorkflowService.generateSampleExcel()

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="info-blog-post-sample.xlsx"')
    res.send(buffer)
  }

  private _validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new CustomHttpException(ErrorCode.WORKFLOW_EXCEL_FILE_REQUIRED, { message: '엑셀 파일은 필수입니다.' })
    }
  }
}
