import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { EnvConfig } from '@main/config/env.config'
import { TopicResult } from './topic-job.types'

export async function saveTopicsResultAsXlsx(jobId: string, topics: TopicResult[]) {
  // 토픽 결과를 Excel 형식으로 변환
  const topicsForExcel = topics.map(topic => ({
    제목: topic.title,
    내용: topic.content,
    예약날짜: '',
    라벨: '',
    발행블로그유형: '',
    발행블로그이름: '',
    카테고리: '',
  }))

  // 엑셀 시트 생성
  const worksheet = XLSX.utils.json_to_sheet(topicsForExcel)

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

  // 파일 저장
  try {
    if (!fs.existsSync(EnvConfig.exportsDir)) {
      fs.mkdirSync(EnvConfig.exportsDir, { recursive: true })
    }
    const xlsxFilePath = path.join(EnvConfig.exportsDir, `find-topics-${jobId}.xlsx`)
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    fs.writeFileSync(xlsxFilePath, buffer)
  } catch (err) {
    console.error('엑셀 파일 저장 중 오류:', err)
    throw err
  }
}
