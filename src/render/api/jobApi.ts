import { api } from './apiClient'
import { CoupangBlogPostJobResponse } from '@render/types/coupangBlogPostJob'

export interface JobLog {
  id: string
  jobId: string
  message: string
  level: string
  createdAt: string
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

export enum JobTargetType {
  BLOG_INFO_POSTING = 'blog-info-posting',
  GENERATE_TOPIC = 'generate_topic',
  COUPANG_REVIEW_POSTING = 'coupang-review-posting',
}

export interface TopicJobDetail {
  id: string
  jobId: string
  topic: string
  limit: number
  result: { title: string; content: string }[] | null
  status: string
  createdAt: string
  updatedAt: string
  xlsxFileName: string | null
}

export interface BlogJobDetail {
  id: string
  jobId: string
  title: string
  content: string
  status: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  blogName?: string
}

export interface BaseJob {
  id: string
  targetType: JobTargetType
  subject: string
  desc: string
  status: JobStatus
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
}

export interface TopicJob extends BaseJob {
  targetType: JobTargetType.GENERATE_TOPIC
  topicJob: TopicJobDetail
  blogJob: null
  coupangBlogJob: null
}

export interface BlogPostJob extends BaseJob {
  targetType: JobTargetType.BLOG_INFO_POSTING
  blogJob: BlogJobDetail
  topicJob: null
  coupangBlogJob: null
}

export interface CoupangBlogJob extends BaseJob {
  coupangBlogJob: CoupangBlogPostJobResponse
  blogJob: null
  topicJob: null
}

export type Job = TopicJob | BlogPostJob | CoupangBlogJob

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
  const response = await api.get('/jobs', { params })
  return response.data
}

// 유형별 전용 API 함수들
export const getBlogJobs = async (params: JobQueryParams = {}): Promise<Job[]> => {
  const response = await api.get('/jobs/blog', { params })
  return response.data
}

export const getCoupangJobs = async (params: JobQueryParams = {}): Promise<Job[]> => {
  const response = await api.get('/jobs/coupang', { params })
  return response.data
}

export const getTopicJobs = async (params: JobQueryParams = {}): Promise<Job[]> => {
  const response = await api.get('/jobs/topic', { params })
  return response.data
}

export const getJobLogs = async (jobId: string): Promise<JobLog[]> => {
  const response = await api.get(`/logs/${jobId}`)
  return response.data
}

export const getLatestJobLog = async (jobId: string): Promise<JobLog | null> => {
  try {
    const response = await api.get(`/logs/${jobId}/latest`)
    return response.data
  } catch {
    return null
  }
}

export const retryJob = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await api.post(`/jobs/${id}/retry`)
  return response.data
}

export const deleteJob = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await api.delete(`/jobs/${id}`)
  return response.data
}

export const retryJobs = async (ids: string[]): Promise<{ success: boolean; message: string; details?: any }> => {
  const response = await api.post('/jobs/bulk/retry', { jobIds: ids })
  return response.data
}

export const deleteJobs = async (ids: string[]): Promise<{ success: boolean; message: string; details?: any }> => {
  const response = await api.post('/jobs/bulk/delete', { jobIds: ids })
  return response.data
}

export const requestToPending = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await api.patch(`/jobs/${id}`, { status: 'pending' })
  return response.data
}

export const pendingToRequest = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await api.patch(`/jobs/${id}`, { status: 'request' })
  return response.data
}

export const downloadJobFile = async (jobId: string): Promise<Blob> => {
  const response = await api.get(`/jobs/${jobId}/download`, {
    responseType: 'blob',
  })
  return response.data
}

export const downloadTopicJobResult = async (jobId: string): Promise<Blob> => {
  const response = await api.get(`/topic-job/download-topic-job/${jobId}`, {
    responseType: 'blob',
  })
  return response.data
}

export const getJobStatus = async (jobId: string): Promise<Job> => {
  const response = await api.get(`/jobs/${jobId}`)
  return response.data
}
