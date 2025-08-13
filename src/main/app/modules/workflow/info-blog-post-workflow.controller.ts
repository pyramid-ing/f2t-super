import { Controller, Post, Logger, Res, UploadedFile, UseInterceptors, UseGuards, Body } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import * as XLSX from 'xlsx'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { InfoBlogPostJobService } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.service'
import { InfoBlogPostExcelRow } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.types'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

@Controller('workflow/info-blog-post')
@UseGuards(AuthGuard)
export class InfoBlogPostWorkflowController {
  private readonly logger = new Logger(InfoBlogPostWorkflowController.name)

  constructor(private readonly infoBlogPostJobService: InfoBlogPostJobService) {}

  /**
   * 워크플로우 등록
   * POST /workflow/post
   */
  @Post('post')
  @Permissions(Permission.USE_INFO_POSTING)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndQueue(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Res() res: Response,
  ): Promise<void> {
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
    }) as InfoBlogPostExcelRow[]

    // 즉시요청 여부 파싱 (기본값 true)
    const immediate = (() => {
      const v = body?.immediateRequest
      switch (typeof v) {
        case 'boolean':
          return v
        case 'string':
          switch (v) {
            case 'true':
            case '1':
              return true
            case 'false':
            case '0':
              return false
            default:
              return true
          }
        default:
          return true
      }
    })()

    // BlogPostJobService로 위임
    const jobs = await this.infoBlogPostJobService.createJobsFromExcelRows(data, immediate)

    this.logger.log(`✅ 총 ${jobs.length}건의 포스트 작업이 Job Queue에 등록됨`)

    res.status(201).json({
      success: true,
      message: `${jobs.length}건 등록 완료`,
      jobIds: jobs.map(job => job.id),
    })
  }
}
