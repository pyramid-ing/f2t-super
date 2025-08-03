// 도메인별 API export만 남기고, 기존 함수 구현은 모두 제거합니다.
export { api } from './apiClient'
export * from './bloggerApi'
export * from './coupangPartnersApi'
export * from './googleBlogApi'
export * from './googleOAuthApi'
export * from './googleStorageApi'
export * from './jobApi'
export * from './settingsApi'
export * from './thumbnailApi'
export * from './workflowApi'
export * from './wordpressApi'
export * from './tistoryApi'
export * from './coupangReviewPostingApi'
export * from './coupangBlogPostJobApi'

export enum JobTargetType {
  BLOG_INFO_POSTING = 'blog-info-posting',
  GENERATE_TOPIC = 'generate_topic',
  COUPANG_REVIEW_POSTING = 'coupang-review-posting',
}

export const JOB_STATUS = {
  REQUEST: 'request',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  request: '등록요청',
  pending: '등록대기',
  processing: '처리중',
  completed: '완료',
  failed: '실패',
}

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS]

export interface TopicJobDetail {
  id: string
  jobId: string
  topic: string
  limit: number
  result: { title: string; content: string }[] | null
  status: string
  createdAt: string
  updatedAt: string
  xlsxFileName: string | null
}

export interface BlogJobDetail {
  id: string
  jobId: string
  title: string
  content: string
  status: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  blogName?: string
}

export interface CoupangBlogJobDetail {
  id: string
  jobId: string
  coupangUrl: string
  platform: 'wordpress' | 'tistory' | 'google'
  status: 'draft' | 'published' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface BaseJob {
  id: string
  type: string
  subject: string
  desc: string
  status: JobStatus
  priority: number
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  loginId: string
  resultMsg?: string
  resultUrl?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
  logs?: JobLog[]
}

export interface TopicJob extends BaseJob {
  type: 'generate_topic'
  topicJob: TopicJobDetail
  blogJob: null
  coupangBlogJob: null
}

export interface BlogPostJob extends BaseJob {
  type: 'blog-info-posting'
  blogJob: BlogJobDetail
  topicJob: null
  coupangBlogJob: null
}

export interface CoupangBlogJob extends BaseJob {
  type: 'coupang-review-posting'
  coupangBlogJob: CoupangBlogJobDetail
  blogJob: null
  topicJob: null
}

export type Job = TopicJob | BlogPostJob | CoupangBlogJob

export interface JobLog {
  id: string
  jobId: string
  message: string
  level: string
  createdAt: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}
