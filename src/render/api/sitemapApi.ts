import { api } from './apiClient'

export interface SitemapConfig {
  id: string
  name: string
  sitemapType: string
  isEnabled: boolean
  lastParsed?: string
}

export interface CreateSitemapConfigDto {
  name: string
  sitemapType: string
  isEnabled?: boolean
}

export interface UpdateSitemapConfigDto {
  name?: string
  sitemapType?: string
  isEnabled?: boolean
}

export interface IndexingConfig {
  mode: 'recentCount' | 'recentDays' | 'fromDate' | 'all'
  count?: number
  days?: number
  startDate?: string
}

export interface IndexJob {
  id: string
  url: string
  provider: string
  status: string
  createdAt: string
  job?: {
    status: string
    result?: string
    errorMessage?: string
  }
}

export interface IndexJobsResponse {
  jobs: IndexJob[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export const sitemapApi = {
  // 사이트맵 설정 목록 조회
  getSitemapConfigs: (siteId: number): Promise<SitemapConfig[]> => {
    return api.get(`/sitemap/configs/${siteId}`).then(res => res.data)
  },

  // 사이트맵 설정 생성
  createSitemapConfig: (siteId: number, data: CreateSitemapConfigDto): Promise<SitemapConfig> => {
    return api.post(`/sitemap/configs/${siteId}`, data).then(res => res.data)
  },

  // 사이트맵 설정 수정
  updateSitemapConfig: (id: string, data: UpdateSitemapConfigDto): Promise<SitemapConfig> => {
    return api.put(`/sitemap/configs/${id}`, data).then(res => res.data)
  },

  // 사이트맵 설정 삭제
  deleteSitemapConfig: (id: string): Promise<void> => {
    return api.delete(`/sitemap/configs/${id}`).then(res => res.data)
  },

  // 색인 기준 설정 조회
  getIndexingConfig: (siteId: number): Promise<IndexingConfig> => {
    return api.get(`/sitemap/indexing-config/${siteId}`).then(res => res.data)
  },

  // 색인 기준 설정 업데이트
  updateIndexingConfig: (siteId: number, config: IndexingConfig): Promise<void> => {
    return api.put(`/sitemap/indexing-config/${siteId}`, config).then(res => res.data)
  },

  // 인덱싱 작업 목록 조회
  getIndexJobs: (siteId: number, page = 1, limit = 50): Promise<IndexJobsResponse> => {
    return api
      .get(`/sitemap/jobs/${siteId}`, {
        params: { page, limit },
      })
      .then(res => res.data)
  },

  // 수동 사이트맵 파싱
  parseSitemap: (siteId: number): Promise<{ message: string }> => {
    return api.post(`/sitemap/parse/${siteId}`).then(res => res.data)
  },
}
