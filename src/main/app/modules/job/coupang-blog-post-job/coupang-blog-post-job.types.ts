export enum CoupangBlogPostJobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export class CoupangBlogPostJobResponse {
  id: string
  coupangUrl: string
  coupangAffiliateLink?: string
  title: string
  content: string
  labels?: any
  tags?: any
  category?: string
  resultUrl?: string
  status: CoupangBlogPostJobStatus
  publishedAt?: string
  createdAt: string
  updatedAt: string
  jobId: string
  bloggerAccountId?: string
  wordpressAccountId?: number
  tistoryAccountId?: number
}
