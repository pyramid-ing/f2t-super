export interface CoupangProductData {
  title: string
  price: number
  originalUrl: string
  affiliateUrl: string
  images: string[]
  reviews: {
    positive: CoupangReview[]
  }
}

export interface CoupangReview {
  content: string
  rating: number
  author: string
  date: string
}

export interface CoupangCrawlerOptions {
  headless?: boolean
  timeout?: number
  userAgent?: string
}

export interface CoupangCrawlerError {
  code: string
  message: string
  details?: any
}
