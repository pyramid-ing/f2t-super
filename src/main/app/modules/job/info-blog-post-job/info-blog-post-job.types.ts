export type InfoBlogPostExcelRow = {
  제목: string
  내용: string
  예약날짜: string
  라벨?: string
  블로그이름?: string
  상태?: string // optional: '공개' | '비공개'
  등록상태?: string // optional: '공개' | '비공개'
}

export interface SectionContent {
  html: string
  imageUrl?: string
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
  platform: string
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
    imageUrl?: string
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
