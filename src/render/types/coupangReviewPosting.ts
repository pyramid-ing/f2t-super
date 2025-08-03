export interface CoupangReviewPostingRequest {
  coupangUrl: string
  blogType: 'wordpress' | 'tistory' | 'google'
  accountId?: number
}

export interface CoupangReviewPostingBulkRequest {
  items: {
    coupangUrl: string
    blogType: 'wordpress' | 'tistory' | 'google'
    accountId?: number
  }[]
}

export interface CoupangReviewPostingResult {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  postUrl?: string
}
