import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'

@Injectable()
export class UtilService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 주어진 경로가 로컬 파일 경로인지 확인합니다.
   * Unix 스타일 경로(/로 시작), 상대 경로(.으로 시작), Windows 드라이브 경로(C:\ 등) 를 지원합니다.
   */
  isLocalPath(path: string): boolean {
    return path.startsWith('/') || path.startsWith('.') || /^[a-zA-Z]:\\/.test(path)
  }

  /**
   * HTML 문자열에서 텍스트만 추출합니다.
   */
  extractTextContent(html: string): string {
    if (!html) return ''
    // cheerio는 이미 dependencies에 포함되어 있음
    const cheerio = require('cheerio')
    const $ = cheerio.load(html)
    return $.text().replace(/\s+/g, ' ').trim()
  }

  /**
   * 임시 폴더를 안전하게 정리합니다.
   * 폴더 내 모든 파일과 하위 폴더를 재귀적으로 삭제합니다.
   */
  cleanupTempFolder(folderPath: string): void {
    try {
      if (!fs.existsSync(folderPath)) {
        return
      }

      // fs.rmSync를 사용하여 더 안전하게 폴더 삭제
      fs.rmSync(folderPath, { recursive: true, force: true })
    } catch (error) {
      console.warn(`임시 폴더 정리 중 오류 발생: ${folderPath}`, error)
    }
  }
}
