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
  // 확장 스키마 (선택적)
  faq?: AgodaFaqItem[]
  prosCons?: AgodaProsCons
  ratingSummary?: AgodaRatingSummary
  facts?: AgodaFacts
  ctas?: AgodaCTA[]
  tables?: AgodaTable[]
}

export interface AgodaFaqItem {
  question: string
  answer: string
}

export interface AgodaProsCons {
  pros: string[]
  cons: string[]
}

export interface AgodaRatingSummary {
  score: number
  reviewCount?: number
  highlights?: string[]
}

export interface AgodaFacts {
  checkIn?: string
  checkOut?: string
  location?: string
  features?: string[]
}

export interface AgodaCTA {
  label: string
  hrefText: string
  position?: 'top' | 'middle' | 'bottom'
}

export interface AgodaTable {
  title?: string
  rows: { label: string; value: string }[]
}
