export enum CoupangBlogPostJobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export class CoupangBlogPostJobResponse {
  id: string
  coupangUrls?: string[]
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
  bloggerAccountId?: number
  wordpressAccountId?: number
  tistoryAccountId?: number
}

export interface CoupangBlogPostPublish {
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

export interface CoupangBlogPost {
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
