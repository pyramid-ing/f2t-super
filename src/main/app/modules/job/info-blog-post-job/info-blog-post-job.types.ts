export type InfoBlogPostExcelRow = {
  제목: string
  내용: string
  예약날짜: string
  모드?: string // '자동' | '수동'
  라벨?: string
  블로그이름?: string
  발행블로그유형?: string
  발행블로그이름?: string
  카테고리?: string
  상태?: string // optional: '공개' | '비공개'
  등록상태?: string // optional: '공개' | '비공개'
}

export interface ImageInfo {
  url: string
  filename: string
  alt: string
}

export interface SectionContent {
  html: string
  img?: ImageInfo
  adHtml?: string
  links?: LinkResult[]
  youtubeLinks?: YoutubeResult[]
}

export interface ProcessedSection extends SectionContent {
  sectionIndex: number
  imageUrlUploaded?: string
}

export enum InfoBlogPostJobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export interface InfoBlogPostPublish {
  accountId: number | string
  platform: import('../job.types').BlogType | string
  title: string
  localThumbnailUrl: string
  thumbnailUrl: string
  contentHtml: string
  category?: string
  labels?: string[]
  tags: string[]
}

export interface InfoBlogPost {
  title: string
  thumbnailUrl?: string
  sections: {
    html: string
    img?: ImageInfo
    links?: LinkResult[]
    youtubeLinks?: YoutubeResult[]
    aiImagePrompt?: string
    adHtml?: string
  }[]
  thumbnailText?: {
    lines: string[]
  }
  tags: string[]
}

export interface LinkResult {
  name: string
  link: string
}

export interface YoutubeResult {
  title: string
  videoId: string
  url: string
}
