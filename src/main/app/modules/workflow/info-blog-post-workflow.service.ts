import { Injectable, Logger } from '@nestjs/common'
import * as XLSX from 'xlsx'
import { InfoBlogPostJobService } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.service'
import { InfoBlogPostExcelRow } from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.types'
import { BlogType } from '@main/app/modules/job/job.types'

export interface InfoBlogPostWorkflowResult {
  success: boolean
  message: string
  jobIds: string[]
  totalProcessed: number
}

@Injectable()
export class InfoBlogPostWorkflowService {
  private readonly logger = new Logger(InfoBlogPostWorkflowService.name)

  constructor(private readonly infoBlogPostJobService: InfoBlogPostJobService) {}

  /**
   * 엑셀 파일과 폼 데이터를 기반으로 워크플로우를 처리합니다.
   */
  public async processWorkflow(
    file: Express.Multer.File,
    formData: {
      immediateRequest?: any
      blogType?: string
      accountId?: string
      scheduledAt?: string
      category?: string
      labels?: string
    },
  ): Promise<InfoBlogPostWorkflowResult> {
    // 엑셀 파일 파싱
    const excelRows = this._parseExcelFile(file)

    // 즉시요청 여부 파싱
    const immediate = this._parseImmediateRequest(formData.immediateRequest)

    // 폼 데이터 정규화
    const normalizedRows = this._normalizeExcelRows(excelRows, {
      blogType: formData.blogType,
      accountId: formData.accountId,
      scheduledAt: formData.scheduledAt,
      category: formData.category,
      labels: formData.labels,
    })

    // BlogPostJobService로 위임하여 작업 생성
    const jobs = await this.infoBlogPostJobService.createJobsFromExcelRows(normalizedRows, immediate)

    this.logger.log(`✅ 총 ${jobs.length}건의 포스트 작업이 Job Queue에 등록됨`)

    return {
      success: true,
      message: `${jobs.length}건 등록 완료`,
      jobIds: jobs.map(job => job.id),
      totalProcessed: jobs.length,
    }
  }

  /**
   * 엑셀 파일을 파싱하여 InfoBlogPostExcelRow 배열로 변환합니다.
   */
  private _parseExcelFile(file: Express.Multer.File): InfoBlogPostExcelRow[] {
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

    return data
  }

  /**
   * 즉시요청 여부를 파싱합니다.
   */
  private _parseImmediateRequest(value: any): boolean {
    switch (typeof value) {
      case 'boolean':
        return value
      case 'string':
        switch (value) {
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
  }

  /**
   * 폼 데이터를 기반으로 엑셀 행들을 정규화합니다.
   */
  private _normalizeExcelRows(
    rows: InfoBlogPostExcelRow[],
    formData: {
      blogType?: string
      accountId?: string
      scheduledAt?: string
      category?: string
      labels?: string
    },
  ): InfoBlogPostExcelRow[] {
    const { blogType, accountId, scheduledAt, category, labels } = formData

    return rows.map(row => {
      const normalizedRow: InfoBlogPostExcelRow = { ...row }

      // 폼에서 전달된 단일 입력값이 있으면, 엑셀의 각 row에 기본값으로 주입
      if (category && !normalizedRow.카테고리) {
        normalizedRow.카테고리 = category
      }
      if (labels && !normalizedRow.라벨) {
        normalizedRow.라벨 = labels
      }
      if (scheduledAt && !normalizedRow.예약날짜) {
        normalizedRow.예약날짜 = scheduledAt
      }

      // 블로그 타입과 계정 ID가 모두 제공된 경우
      if (blogType && accountId) {
        const trimmedBlogType = blogType.trim()
        const trimmedAccountId = accountId.trim()

        switch (trimmedBlogType) {
          case BlogType.TISTORY:
            normalizedRow.발행블로그유형 = BlogType.TISTORY
            normalizedRow.발행블로그이름 = trimmedAccountId
            break
          case BlogType.WORDPRESS:
            normalizedRow.발행블로그유형 = BlogType.WORDPRESS
            normalizedRow.발행블로그이름 = trimmedAccountId
            break
          case BlogType.GOOGLE_BLOG:
            normalizedRow.발행블로그유형 = BlogType.GOOGLE_BLOG
            normalizedRow.발행블로그이름 = trimmedAccountId
            break
        }
      }

      // 모드: '수동'인 경우 라벨에 내부 플래그 추가하여 처리 단계에서 식별
      const mode = (normalizedRow.모드 || '').trim()
      if (mode === '수동') {
        const existing = normalizedRow.라벨 ? normalizedRow.라벨.trim() : ''
        const labelsJoined = existing.length > 0 ? `${existing},__manual__` : '__manual__'
        normalizedRow.라벨 = labelsJoined
      }

      return normalizedRow
    })
  }
}
