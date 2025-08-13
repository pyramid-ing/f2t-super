import { api } from './index'

export interface CoupangBlogWorkflowResponse {
  success: boolean
  message: string
  data: {
    totalProcessed: number
    success: number
    failed: number
    jobIds: string[]
    errors: string[]
  }
}

export interface CoupangBlogValidationResponse {
  success: boolean
  message: string
  data: {
    totalRows: number
    validCount: number
    invalidCount: number
    validationResults: Array<{
      row: number
      status: 'valid' | 'invalid'
      message: string
    }>
  }
}

export const workflowApi = {
  /**
   * 쿠팡 블로그 포스트 워크플로우 실행 (수동 입력)
   */
  createCoupangBlogPost: async (data: {
    coupangUrl: string // 줄바꿈으로 여러 개 전달
    blogType: string
    accountId: string
    scheduledAt?: string
    category?: string
    immediateRequest?: boolean
  }): Promise<CoupangBlogWorkflowResponse> => {
    const response = await api.post('/workflow/coupang-blog-post', data)
    return response.data
  },

  /**
   * 쿠팡 블로그 포스트 워크플로우 실행 (엑셀 파일 업로드)
   */
  uploadExcelAndCreateJobs: async (
    file: File,
    immediateRequest: boolean = true,
  ): Promise<CoupangBlogWorkflowResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('immediateRequest', String(immediateRequest))

    const response = await api.post('/workflow/coupang-blog-post/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  },

  /**
   * 쿠팡 블로그 포스트 워크플로우 검증 (엑셀 파일 검증)
   */
  validateExcelFile: async (file: File): Promise<CoupangBlogValidationResponse> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await api.post('/workflow/coupang-blog-post/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  },

  /**
   * 쿠팡 블로그 포스트 샘플 엑셀 다운로드
   */
  downloadSampleExcel: async (): Promise<Blob> => {
    const response = await api.get('/workflow/coupang-blog-post/sample-excel', {
      responseType: 'blob',
    })
    return response.data
  },

  /**
   * 쿠팡 키워드 검색
   */
  searchCoupang: async (
    keyword: string,
    limit: number = 5,
  ): Promise<{ rank: number; title: string; price: number; isRocket: boolean; url: string }[]> => {
    const response = await api.get('/workflow/coupang-blog-post/search', {
      params: { keyword, limit },
    })
    return response.data.data
  },
  addTopicJob: async (topic: string, limit: number = 10, immediateRequest: boolean = true) => {
    const response = await api.get('/workflow/topic/find-topics', {
      params: { topic, limit, immediateRequest },
    })
    return response.data
  },

  registerWorkflow: async (file: File, immediateRequest: boolean = true) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('immediateRequest', String(immediateRequest))
    const response = await api.post('/workflow/info-blog-post/post', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
}
