import { Controller, Post, UploadedFile, UseInterceptors, Logger, Res, Body, Get, Query } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { CoupangBlogPostWorkflowService } from './coupang-blog-post-workflow.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { CreateCoupangBlogPostDto, UploadCoupangExcelDto, SearchCoupangDto } from './dto/coupang-blog-post-workflow.dto'

@Controller('workflow/coupang-blog-post')
export class CoupangBlogPostWorkflowController {
  private readonly logger = new Logger(CoupangBlogPostWorkflowController.name)

  constructor(private readonly coupangBlogPostWorkflowService: CoupangBlogPostWorkflowService) {}

  /**
   * 쿠팡 블로그 포스트 수동 입력
   * POST /workflow/coupang-blog-post
   */
  @Post()
  public async createCoupangBlogPost(@Body() data: CreateCoupangBlogPostDto, @Res() res: Response): Promise<void> {
    this.logger.log(`쿠팡 블로그 포스트 수동 입력 시작`)

    // 단일 데이터를 배열로 변환
    const rows = this.coupangBlogPostWorkflowService.createSingleRowFromData(data)

    const immediate = this.coupangBlogPostWorkflowService.parseImmediateRequest(data?.immediateRequest)
    const result = await this.coupangBlogPostWorkflowService.bulkCreate(rows, immediate)

    this.logger.log(`✅ 쿠팡 블로그 포스트 수동 입력 완료: 성공 ${result.success}건, 실패 ${result.failed}건`)

    res.status(201).json({
      success: true,
      message: '쿠팡 블로그 포스트 작업이 등록되었습니다.',
      data: {
        totalProcessed: result.success + result.failed,
        success: result.success,
        failed: result.failed,
        jobIds: result.jobIds,
        errors: result.errors,
      },
    })
  }

  /**
   * 쿠팡 블로그 포스트 엑셀 업로드 (벌크)
   * POST /workflow/coupang-blog-post/excel
   */
  @Post('excel')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadCoupangBlogPostExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadCoupangExcelDto,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(`쿠팡 블로그 포스트 엑셀 업로드 시작: ${file?.originalname}`)

    if (!file) {
      throw new CustomHttpException(ErrorCode.WORKFLOW_EXCEL_FILE_REQUIRED, {
        message: '엑셀 파일은 필수입니다.',
      })
    }

    // 엑셀 파일 파싱
    const data = this.coupangBlogPostWorkflowService.parseExcelFile(file)

    // 워크플로우 서비스로 위임
    const immediate = this.coupangBlogPostWorkflowService.parseImmediateRequest(body?.immediateRequest)
    const results = await this.coupangBlogPostWorkflowService.bulkCreate(data, immediate)

    this.logger.log(`✅ 쿠팡 블로그 포스트 엑셀 업로드 완료: 성공 ${results.success}건, 실패 ${results.failed}건`)

    res.status(201).json({
      success: true,
      message: `${results.success}건의 쿠팡 블로그 포스트 작업이 등록되었습니다.`,
      data: {
        totalProcessed: results.success + results.failed,
        success: results.success,
        failed: results.failed,
        jobIds: results.jobIds,
        errors: results.errors,
      },
    })
  }

  /**
   * 쿠팡 블로그 포스트 워크플로우 검증
   * POST /workflow/coupang-blog-post/validate
   */
  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  public async validateExcel(@UploadedFile() file: Express.Multer.File, @Res() res: Response): Promise<void> {
    this.logger.log(`쿠팡 블로그 포스트 워크플로우 검증 시작: ${file?.originalname}`)

    if (!file) {
      throw new CustomHttpException(ErrorCode.WORKFLOW_EXCEL_FILE_REQUIRED, {
        message: '엑셀 파일은 필수입니다.',
      })
    }

    // 엑셀 파일 파싱
    const data = this.coupangBlogPostWorkflowService.parseExcelFile(file)

    // 검증 결과
    const result = await this.coupangBlogPostWorkflowService.validateExcelData(data)

    this.logger.log(
      `✅ 쿠팡 블로그 포스트 워크플로우 검증 완료: 유효 ${result.data.validCount}건, 무효 ${result.data.invalidCount}건`,
    )

    res.status(200).json(result)
  }

  /**
   * 쿠팡 블로그 포스트 샘플 엑셀 다운로드
   * GET /workflow/coupang-blog-post/sample-excel
   */
  @Get('sample-excel')
  public async downloadSampleExcel(@Res() res: Response): Promise<void> {
    this.logger.log('쿠팡 블로그 포스트 샘플 엑셀 생성 시작')

    const buffer = this.coupangBlogPostWorkflowService.generateSampleExcel()

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="coupang-blog-post-sample.xlsx"')
    res.send(buffer)
  }

  /**
   * 쿠팡 키워드 검색 결과 상위 리스트 반환
   * GET /workflow/coupang-blog-post/search?keyword=키워드&limit=5
   */
  @Get('search')
  public async searchCoupang(@Query() query: SearchCoupangDto, @Res() res: Response) {
    // 워크플로우 서비스에서 크롤러를 호출하도록 구성할 수도 있지만, 간단히 직접 접근하지 않고 서비스에 위임
    const results = await this.coupangBlogPostWorkflowService.searchCoupangProducts(query.keyword, query.limit)
    res.status(200).json({ success: true, message: '검색이 완료되었습니다.', data: results })
  }
}
