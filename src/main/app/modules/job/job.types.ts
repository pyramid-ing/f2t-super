import { Job } from '@prisma/client'

export enum JobTargetType {
  BLOG_INFO_POSTING = 'blog-info-posting',
  GENERATE_TOPIC = 'generate_topic',
  COUPANG_REVIEW_POSTING = 'coupang-review-posting',
  INDEX = 'index',
}

export enum JobStatus {
  PENDING = 'pending',
  REQUEST = 'request',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum BlogType {
  TISTORY = 'tistory',
  WORDPRESS = 'wordpress',
  GOOGLE_BLOG = 'google_blog',
}

export enum BlogJobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export enum IndexProvider {
  GOOGLE = 'GOOGLE',
  BING = 'BING',
  NAVER = 'NAVER',
  DAUM = 'DAUM',
}

export enum IndexStatus {
  REQUEST = 'request',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export type JobResult = {
  resultUrl?: string
  resultMsg?: string
}

export interface JobProcessor {
  process(jobId: string): Promise<JobResult | void>
  canProcess(job: Job): boolean
}
