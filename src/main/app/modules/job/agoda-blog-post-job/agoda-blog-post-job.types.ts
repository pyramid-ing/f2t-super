export enum AgodaBlogPostJobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export class AgodaBlogPostJobResponse {
  id: string
  agodaUrls?: string[]
  agodaAffiliateLink?: string
  title: string
  content: string
  labels?: any
  tags?: any
  category?: string
  resultUrl?: string
  status: AgodaBlogPostJobStatus
  publishedAt?: string
  createdAt: string
  updatedAt: string
  jobId: string
  bloggerAccountId?: number
  wordpressAccountId?: number
  tistoryAccountId?: number
}

export interface AgodaBlogPostPublish {
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

export interface AgodaBlogPost {
  title: string
  sections: {
    html: string
  }[]
  thumbnailText?: {
    lines: string[]
  }
  jsonLD: {
    '@type': string
    name: string
    brand: string
    image: string
    description: string
    aggregateRating: {
      '@type': string
      ratingValue: number
      reviewCount: number
    }
  }
  tags: string[]
}
