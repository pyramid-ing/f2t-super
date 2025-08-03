export interface CoupangReviewPostingResult {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  postUrl?: string
}

export interface CoupangReviewPostingJob {
  id: string
  coupangUrl: string
  blogType: 'wordpress' | 'tistory' | 'google'
  accountId?: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
  result?: {
    postUrl?: string
    error?: string
  }
}

export interface CoupangProductData {
  title: string
  price: number
  originalUrl: string
  affiliateUrl: string
  images: string[]
  reviews: {
    positive: CoupangReview[]
    negative: CoupangReview[]
  }
}

export interface CoupangReview {
  author: string
  date: string
  content: string
  rating: number
}

export interface GeneratedContent {
  title: string
  content: string
  tags: string[]
  thumbnailImage?: string
}
