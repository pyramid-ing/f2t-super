export type BlogPostExcelRow = {
  제목: string
  내용: string
  예약날짜: string
  라벨?: string
  블로그이름?: string
  상태?: string // optional: '공개' | '비공개'
  등록상태?: string // optional: '공개' | '비공개'
}
