import { Job } from '@prisma/client'

export enum JobType {
  BLOG_INFO_POSTING = 'blog-info-posting',
  GENERATE_TOPIC = 'generate_topic',
  COUPANG_REVIEW_POSTING = 'coupang-review-posting',
}

export enum JobStatus {
  PENDING = 'pending',
  REQUEST = 'request',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum BlogJobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
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

export interface CreateJobDto {
  targetType: string
  subject: string
  desc: string
  status?: string
  priority?: number
  scheduledAt?: Date
}
