import { api } from './apiClient'

// Job 타입을 index.ts와 일치하도록 정의
export interface Job {
  id: string
  type: string
  subject: string
  desc: string
  status: string
  priority: number
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  loginId: string
  resultMsg?: string
  resultUrl?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
  logs?: JobLog[]
  topicJob?: any
  blogJob?: any
  coupangBlogJob?: any
}

export interface JobLog {
  id: string
  jobId: string
  message: string
  level: string
  createdAt: string
}

export enum JobTargetType {
  BLOG_INFO_POSTING = 'blog-info-posting',
  GENERATE_TOPIC = 'generate_topic',
  COUPANG_REVIEW_POSTING = 'coupang-review-posting',
}

export const JOB_STATUS = {
  REQUEST: 'request',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export const JOB_STATUS_LABEL = {
  [JOB_STATUS.REQUEST]: '등록요청',
  [JOB_STATUS.PENDING]: '등록대기',
  [JOB_STATUS.PROCESSING]: '처리중',
  [JOB_STATUS.COMPLETED]: '완료',
  [JOB_STATUS.FAILED]: '실패',
} as const

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS]

export interface JobQueryParams {
  status?: JobStatus
  targetType?: JobTargetType
  search?: string
  orderBy?: string
  order?: 'asc' | 'desc'
}

// 기존 API 함수들
export const getJobs = async (params: JobQueryParams = {}): Promise<Job[]> => {
  const response = await api.get('/api/jobs', { params })
  return response.data
}

// 유형별 전용 API 함수들
export const getBlogJobs = async (params: JobQueryParams = {}): Promise<Job[]> => {
  const response = await api.get('/api/jobs/blog', { params })
  return response.data
}

export const getCoupangJobs = async (params: JobQueryParams = {}): Promise<Job[]> => {
  const response = await api.get('/api/jobs/coupang', { params })
  return response.data
}

export const getTopicJobs = async (params: JobQueryParams = {}): Promise<Job[]> => {
  const response = await api.get('/api/jobs/topic', { params })
  return response.data
}

export const getJobLogs = async (jobId: string): Promise<JobLog[]> => {
  const response = await api.get(`/api/jobs/${jobId}/logs`)
  return response.data
}

export const getLatestJobLog = async (jobId: string): Promise<JobLog | null> => {
  try {
    const response = await api.get(`/api/jobs/${jobId}/logs/latest`)
    return response.data
  } catch {
    return null
  }
}

export const retryJob = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await api.post(`/api/jobs/${id}/retry`)
  return response.data
}

export const deleteJob = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await api.delete(`/api/jobs/${id}`)
  return response.data
}

export const retryJobs = async (ids: string[]): Promise<{ success: boolean; message: string }> => {
  const response = await api.post('/api/jobs/retry', { ids })
  return response.data
}

export const deleteJobs = async (ids: string[]): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete('/api/jobs', { data: { ids } })
  return response.data
}

export const requestToPending = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await api.patch(`/api/jobs/${id}/status`, { status: 'pending' })
  return response.data
}

export const pendingToRequest = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await api.patch(`/api/jobs/${id}/status`, { status: 'request' })
  return response.data
}

export const downloadJobFile = async (jobId: string): Promise<Blob> => {
  const response = await api.get(`/api/jobs/${jobId}/download`, {
    responseType: 'blob',
  })
  return response.data
}

export const downloadTopicJobResult = async (jobId: string): Promise<Blob> => {
  const response = await api.get(`/api/topic-job/download-topic-job/${jobId}`, {
    responseType: 'blob',
  })
  return response.data
}

export const getJobStatus = async (jobId: string): Promise<Job> => {
  const response = await api.get(`/api/jobs/${jobId}`)
  return response.data
}
