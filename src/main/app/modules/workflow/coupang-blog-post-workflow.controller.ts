import { Controller, Post, UploadedFile, UseInterceptors, Logger, Res, Body, Get } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import * as XLSX from 'xlsx'
import { CoupangBlogPostWorkflowService, CoupangBlogExcelRow } from './coupang-blog-post-workflow.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Controller('workflow/coupang-blog-post')
export class CoupangBlogPostWorkflowController {
  private readonly logger = new Logger(CoupangBlogPostWorkflowController.name)

  constructor(private readonly coupangBlogPostWorkflowService: CoupangBlogPostWorkflowService) {}

  /**
   * 쿠팡 블로그 포스트 수동 입력
   * POST /workflow/coupang-blog-post
   */
  @Post()
  async createCoupangBlogPost(@Body() data: any, @Res() res: Response): Promise<void> {
    try {
      this.logger.log(`쿠팡 블로그 포스트 수동 입력 시작`)

      // 단일 데이터를 배열로 변환
      const rows = (() => {
        const raw = (data.coupangUrl || '').trim()
        // 텍스트에 줄바꿈이 포함되면 그대로 1행으로 넘기고, 서비스에서 분기 처리
        return [
          {
            쿠팡url: raw,
            발행블로그유형: data.blogType,
            발행블로그이름: data.accountId,
            예약날짜: data.scheduledAt,
            카테고리: data.category,
          },
        ]
      })()

      const result = await this.coupangBlogPostWorkflowService.bulkCreate(rows)

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
    } catch (error) {
      this.logger.error('쿠팡 블로그 포스트 수동 입력 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '쿠팡 블로그 포스트 작업 생성에 실패했습니다.',
      })
    }
  }

  /**
   * 쿠팡 블로그 포스트 엑셀 업로드 (벌크)
   * POST /workflow/coupang-blog-post/excel
   */
  @Post('excel')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCoupangBlogPostExcel(@UploadedFile() file: Express.Multer.File, @Res() res: Response): Promise<void> {
    try {
      this.logger.log(`쿠팡 블로그 포스트 엑셀 업로드 시작: ${file?.originalname}`)

      if (!file) {
        throw new CustomHttpException(ErrorCode.WORKFLOW_EXCEL_FILE_REQUIRED, {
          message: '엑셀 파일은 필수입니다.',
        })
      }

      // 엑셀 파일 파싱
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
      }) as CoupangBlogExcelRow[]

      // 워크플로우 서비스로 위임
      const results = await this.coupangBlogPostWorkflowService.bulkCreate(data)

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
    } catch (error) {
      this.logger.error('쿠팡 블로그 포스트 엑셀 업로드 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '쿠팡 블로그 포스트 엑셀 업로드에 실패했습니다.',
      })
    }
  }

  /**
   * 쿠팡 블로그 포스트 워크플로우 검증
   * POST /workflow/coupang-blog-post/validate
   */
  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  async validateExcel(@UploadedFile() file: Express.Multer.File, @Res() res: Response): Promise<void> {
    try {
      this.logger.log(`쿠팡 블로그 포스트 워크플로우 검증 시작: ${file?.originalname}`)

      if (!file) {
        throw new CustomHttpException(ErrorCode.WORKFLOW_EXCEL_FILE_REQUIRED, {
          message: '엑셀 파일은 필수입니다.',
        })
      }

      // 엑셀 파일 파싱
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
      }) as CoupangBlogExcelRow[]

      // 검증 결과
      const validationResults = []
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const rowNumber = i + 2 // 엑셀 행 번호 (헤더 제외)

        try {
          // 기본 필드 검증
          if (!row.쿠팡url || !row.발행블로그유형 || !row.발행블로그이름) {
            throw new Error('필수 필드가 누락되었습니다.')
          }

          // 블로그 타입 검증
          const blogType = this.coupangBlogPostWorkflowService.parseBlogType(row.발행블로그유형)

          // 발행 아이디 검증
          await this.coupangBlogPostWorkflowService.validatePublishId(blogType, row.발행블로그이름)

          validationResults.push({
            row: rowNumber,
            status: 'valid',
            message: '검증 성공',
          })
        } catch (error) {
          validationResults.push({
            row: rowNumber,
            status: 'invalid',
            message: error.message,
          })
        }
      }

      const validCount = validationResults.filter(r => r.status === 'valid').length
      const invalidCount = validationResults.filter(r => r.status === 'invalid').length

      this.logger.log(`✅ 쿠팡 블로그 포스트 워크플로우 검증 완료: 유효 ${validCount}건, 무효 ${invalidCount}건`)

      res.status(200).json({
        success: true,
        message: `쿠팡 블로그 포스트 워크플로우 검증 완료: 유효 ${validCount}건, 무효 ${invalidCount}건`,
        data: {
          totalRows: data.length,
          validCount,
          invalidCount,
          validationResults,
        },
      })
    } catch (error) {
      this.logger.error('쿠팡 블로그 포스트 워크플로우 검증 실패:', error)

      if (error instanceof CustomHttpException) {
        throw error
      }

      throw new CustomHttpException(ErrorCode.WORKFLOW_VALIDATION_FAILED, {
        message: `쿠팡 블로그 포스트 워크플로우 검증에 실패했습니다: ${error.message}`,
      })
    }
  }

  /**
   * 쿠팡 블로그 포스트 샘플 엑셀 다운로드
   * GET /workflow/coupang-blog-post/sample-excel
   */
  @Get('sample-excel')
  async downloadSampleExcel(@Res() res: Response): Promise<void> {
    try {
      this.logger.log('쿠팡 블로그 포스트 샘플 엑셀 생성 시작')

      // 샘플 데이터 (첫 행은 헤더 아님: 헤더는 아래에서 별도 지정)
      const sampleRows = [
        ['https://www.coupang.com/vp/products/111111111', 'tistory', '내티스토리', '2025-08-15', '리뷰'],
        [
          'https://www.coupang.com/vp/products/222222222\nhttps://www.coupang.com/vp/products/333333333',
          'wordpress',
          '내워드프레스',
          '',
          '비교리뷰',
        ],
        ['https://www.coupang.com/vp/products/444444444', 'blogger', '내블로거', '', '가전'],
      ]

      const headers = ['쿠팡url', '발행블로그유형', '발행블로그이름', '예약날짜', '카테고리']
      const aoa = [headers, ...sampleRows]

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, '샘플')

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="coupang-blog-post-sample.xlsx"')
      res.send(buffer)
    } catch (error) {
      this.logger.error('샘플 엑셀 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '샘플 엑셀 생성에 실패했습니다.',
      })
    }
  }
}
