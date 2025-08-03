import {
  CoupangReviewPostingBulkRequest,
  CoupangReviewPostingRequest,
  CoupangReviewPostingResult,
} from '@render/types/coupangReviewPosting'
import { api } from './apiClient'

// 단일 포스팅 시작
export async function startSingleCoupangReviewPosting(request: CoupangReviewPostingRequest) {
  const response = await api.post<CoupangReviewPostingResult>('/coupang-review-posting/single', request)
  return response.data
}

// 벌크 포스팅 시작
export async function startBulkCoupangReviewPosting(request: CoupangReviewPostingBulkRequest) {
  const response = await api.post<CoupangReviewPostingResult[]>('/coupang-review-posting/bulk', request)
  return response.data
}
