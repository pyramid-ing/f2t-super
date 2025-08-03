import {
  CreateCoupangBlogPostJobRequest,
  CoupangBlogPostJobResponse,
  CoupangBlogPostJobStatus,
} from '@render/types/coupangBlogPostJob'
import { api } from './apiClient'

// 쿠팡 블로그 포스트 작업 생성
export async function createCoupangBlogPostJob(
  request: CreateCoupangBlogPostJobRequest,
): Promise<CoupangBlogPostJobResponse> {
  const response = await api.post<CoupangBlogPostJobResponse>('/api/coupang-blog-post-jobs', request)
  return response.data
}

// 쿠팡 블로그 포스트 작업 조회
export async function getCoupangBlogPostJob(jobId: string): Promise<CoupangBlogPostJobResponse | null> {
  const response = await api.get<CoupangBlogPostJobResponse | null>(`/api/coupang-blog-post-jobs/${jobId}`)
  return response.data
}

// 쿠팡 블로그 포스트 작업 목록 조회
export async function getCoupangBlogPostJobs(status?: CoupangBlogPostJobStatus): Promise<CoupangBlogPostJobResponse[]> {
  const params = status ? { status } : {}
  const response = await api.get<CoupangBlogPostJobResponse[]>('/api/coupang-blog-post-jobs', { params })
  return response.data
}

// 쿠팡 블로그 포스트 작업 업데이트
export async function updateCoupangBlogPostJob(
  jobId: string,
  request: Partial<CreateCoupangBlogPostJobRequest>,
): Promise<CoupangBlogPostJobResponse> {
  const response = await api.put<CoupangBlogPostJobResponse>(`/api/coupang-blog-post-jobs/${jobId}`, request)
  return response.data
}

// 쿠팡 블로그 포스트 작업 삭제
export async function deleteCoupangBlogPostJob(jobId: string): Promise<void> {
  await api.delete(`/api/coupang-blog-post-jobs/${jobId}`)
}

// 쿠팡 블로그 포스트 작업 상태 업데이트
export async function updateCoupangBlogPostJobStatus(
  jobId: string,
  status: CoupangBlogPostJobStatus,
): Promise<CoupangBlogPostJobResponse> {
  const response = await api.put<CoupangBlogPostJobResponse>(`/api/coupang-blog-post-jobs/${jobId}/status`, { status })
  return response.data
}
