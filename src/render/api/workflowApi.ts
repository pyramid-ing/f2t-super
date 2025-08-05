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
    coupangUrl: string
    blogType: string
    accountId: string
    scheduledAt?: string
    category?: string
  }): Promise<CoupangBlogWorkflowResponse> => {
    const response = await api.post('/workflow/coupang-blog-post', data)
    return response.data
  },

  /**
   * 쿠팡 블로그 포스트 워크플로우 실행 (엑셀 파일 업로드)
   */
  uploadExcelAndCreateJobs: async (file: File): Promise<CoupangBlogWorkflowResponse> => {
    const formData = new FormData()
    formData.append('file', file)

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
  addTopicJob: async (topic: string, limit: number = 10) => {
    const response = await api.get('/workflow/find-topics', {
      params: { topic, limit },
    })
    return response.data
  },

  registerWorkflow: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/workflow/post', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  convertTopicToBlogPost: async (
    topicJobId: string,
    selectedTopics: number[],
    platform: 'blogger' | 'wordpress' | 'tistory',
    accountId?: string,
  ) => {
    const response = await api.post('/topic-job/convert-to-blog-post', {
      topicJobId,
      selectedTopics,
      platform,
      accountId,
    })
    return response.data
  },

  improveTopicQuality: async (topic: { title: string; content: string }) => {
    const response = await api.post('/topic-job/improve-quality', { topic })
    return response.data
  },

  classifyTopic: async (topic: { title: string; content: string }) => {
    const response = await api.post('/topic-job/classify', { topic })
    return response.data
  },
}
