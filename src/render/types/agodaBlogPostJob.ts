export interface AgodaBlogPostJobResponse {
  id: string
  jobId: string
  agodaUrls?: string[]
  title: string
  content: string
  category?: string
  labels?: any
  tags?: any
  status: AgodaBlogPostJobStatus
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

export type AgodaBlogPostJobStatus = 'draft' | 'published' | 'failed'
