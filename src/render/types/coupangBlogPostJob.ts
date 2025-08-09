export interface CreateCoupangBlogPostJobRequest {
  subject: string
  desc: string
  coupangUrls: string[]
  coupangAffiliateLink?: string
  title: string
  content: string
  category?: string
  labels?: any
  tags?: any
  bloggerAccountId?: string
  wordpressAccountId?: number
  tistoryAccountId?: number
  scheduledAt?: string
  priority?: number
}

export interface UpdateCoupangBlogPostJobRequest {
  title?: string
  content?: string
  category?: string
  labels?: any
  tags?: any
  status?: CoupangBlogPostJobStatus
  resultUrl?: string
  coupangAffiliateLink?: string
  publishedAt?: string
}

export interface CoupangBlogPostJobResponse {
  id: string
  jobId: string
  coupangUrls?: string[]
  coupangAffiliateLink?: string
  title: string
  content: string
  category?: string
  labels?: any
  tags?: any
  status: 'draft' | 'published' | 'failed'
  resultUrl?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
  bloggerAccountId?: string
  wordpressAccountId?: number
  tistoryAccountId?: number
  job: {
    id: string
    targetType: string
    subject: string
    desc: string
    status: string
    priority: number
    scheduledAt: string
    createdAt: string
    updatedAt: string
  }
  bloggerAccount?: any
  wordpressAccount?: any
  tistoryAccount?: any
}

export type CoupangBlogPostJobStatus = 'draft' | 'published' | 'failed'
