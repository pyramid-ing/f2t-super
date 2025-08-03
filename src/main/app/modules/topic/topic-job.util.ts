import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { EnvConfig } from '@main/config/env.config'
import { BlogPostExcelRow } from '@main/app/modules/job/blog-post-job/blog-post-job.types'

export async function saveTopicsResultAsXlsx(jobId: string, topics: any[]) {
  // 예약날짜 필드, 라벨 필드, 블로거 ID 필드 추가(공란)
  const topicsWithDate: BlogPostExcelRow[] = topics.map(row => ({
    제목: row.title,
    내용: row.content,
    예약날짜: '',
    라벨: '',
    블로그이름: '',
  }))

  // 엑셀 시트 생성 (topics 객체 배열 그대로 사용)
  const worksheet = XLSX.utils.json_to_sheet(topicsWithDate)

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { width: 40 }, // 제목
    { width: 80 }, // 내용
    { width: 20 }, // 예약날짜
    { width: 20 }, // 라벨
    { width: 20 }, // 블로거 ID
  ]

  // 워크북에 시트 추가
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '주제 목록')

  // 파일 저장 (리팩토링)
  try {
    if (!fs.existsSync(EnvConfig.exportsDir)) {
      fs.mkdirSync(EnvConfig.exportsDir, { recursive: true })
    }
    const xlsxFilePath = path.join(EnvConfig.exportsDir, `find-topics-${jobId}.xlsx`)
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    fs.writeFileSync(xlsxFilePath, buffer)
  } catch (err) {
    // 에러 발생 시 로깅 또는 예외 처리
    console.error('엑셀 파일 저장 중 오류:', err)
    throw err
  }
}
