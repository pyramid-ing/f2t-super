import { api } from './apiClient'

export interface GenerateThumbnailRequest {
  title: string
  subtitle?: string
  uploadToGCS?: boolean
  backgroundImageFileName?: string
}

export interface ThumbnailResponse {
  success: boolean
  imageUrl?: string
  base64?: string
  fileName?: string
  error?: string
}

export interface BackgroundImageInfo {
  fileName: string
  filePath: string
  base64?: string
}

export interface ThumbnailLayoutElement {
  id: string
  text: string // {{제목}}, {{부제목}} 등의 템플릿 문법 지원
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  fontWeight: 'normal' | 'bold'
  opacity: number
  rotation: number
  zIndex: number
}

export interface ThumbnailLayoutData {
  id: string
  backgroundImage: string
  elements: ThumbnailLayoutElement[]
  createdAt: string
  updatedAt: string
}

export interface ThumbnailLayoutGenerateRequest {
  backgroundImageFileName: string
  layout: ThumbnailLayoutData
  uploadToGCS?: boolean
  variables?: { [key: string]: string } // 템플릿 변수 (예: {제목: "실제 제목", 부제목: "실제 부제목"})
}

export interface ThumbnailLayout {
  id: string
  name: string
  description?: string
  isDefault: boolean
  previewUrl?: string
  data: ThumbnailLayoutData
  createdAt: string
  updatedAt: string
}

export interface CreateThumbnailLayoutRequest {
  name: string
  description?: string
  data: ThumbnailLayoutData
  isDefault?: boolean
}

export interface UpdateThumbnailLayoutRequest {
  name?: string
  description?: string
  data?: ThumbnailLayoutData
  isDefault?: boolean
}

// React-Konva 기반 썸네일 생성 인터페이스
export interface ThumbnailKonvaRequest {
  layout: {
    id: string
    backgroundImage: string
    elements: Array<{
      id: string
      text: string
      x: number
      y: number
      width: number
      height: number
      fontSize: number
      fontFamily: string
      color: string
      textAlign: 'left' | 'center' | 'right'
      fontWeight: 'normal' | 'bold'
      opacity: number
      rotation: number
      zIndex: number
    }>
    createdAt: string
    updatedAt: string
  }
  variables: { [key: string]: string }
  backgroundImagePath?: string
}

export const thumbnailApi = {
  // 썸네일 생성
  generateThumbnail: async (request: GenerateThumbnailRequest): Promise<ThumbnailResponse> => {
    const response = await api.post('/api/thumbnail/generate', request)
    return response.data
  },

  // 썸네일 미리보기 생성
  previewThumbnail: async (request: GenerateThumbnailRequest): Promise<ThumbnailResponse> => {
    const response = await api.post('/api/thumbnail/preview', request)
    return response.data
  },

  // 배경이미지 업로드
  uploadBackgroundImage: async (file: File): Promise<{ success: boolean; fileName?: string; error?: string }> => {
    const formData = new FormData()
    formData.append('backgroundImage', file)

    const response = await api.post('/api/thumbnail/background/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // 배경이미지 목록 조회
  getBackgroundImages: async (): Promise<{ success: boolean; images?: BackgroundImageInfo[]; error?: string }> => {
    const response = await api.get('/api/thumbnail/background/list')
    return response.data
  },

  // 배경이미지 조회 (base64)
  getBackgroundImage: async (fileName: string): Promise<{ success: boolean; base64?: string; error?: string }> => {
    const response = await api.get(`/api/thumbnail/background/${fileName}`)
    return response.data
  },

  // 배경이미지 삭제
  deleteBackgroundImage: async (fileName: string): Promise<{ success: boolean; error?: string }> => {
    const response = await api.delete(`/api/thumbnail/background/${fileName}`)
    return response.data
  },

  // 레이아웃 기반 썸네일 생성
  generateThumbnailWithLayout: async (request: ThumbnailLayoutGenerateRequest): Promise<ThumbnailResponse> => {
    const response = await api.post('/api/thumbnail/layout/generate', request)
    return response.data
  },

  // 레이아웃 기반 썸네일 미리보기
  previewThumbnailWithLayout: async (request: ThumbnailLayoutGenerateRequest): Promise<ThumbnailResponse> => {
    const response = await api.post('/api/thumbnail/layout/preview', request)
    return response.data
  },

  // 레이아웃 관련 API
  // 레이아웃 목록 조회
  getThumbnailLayouts: async (): Promise<{ success: boolean; layouts?: ThumbnailLayout[]; error?: string }> => {
    const response = await api.get('/api/thumbnail/layouts')
    return response.data
  },

  // 레이아웃 생성
  createThumbnailLayout: async (
    request: CreateThumbnailLayoutRequest,
  ): Promise<{ success: boolean; layout?: ThumbnailLayout; error?: string }> => {
    const response = await api.post('/api/thumbnail/layouts', request)
    return response.data
  },

  // 레이아웃 조회
  getThumbnailLayout: async (id: string): Promise<{ success: boolean; layout?: ThumbnailLayout; error?: string }> => {
    const response = await api.get(`/api/thumbnail/layouts/${id}`)
    return response.data
  },

  // 레이아웃 수정
  updateThumbnailLayout: async (
    id: string,
    request: UpdateThumbnailLayoutRequest,
  ): Promise<{ success: boolean; layout?: ThumbnailLayout; error?: string }> => {
    const response = await api.post(`/api/thumbnail/layouts/${id}`, request)
    return response.data
  },

  // 레이아웃 삭제
  deleteThumbnailLayout: async (id: string): Promise<{ success: boolean; error?: string }> => {
    const response = await api.delete(`/api/thumbnail/layouts/${id}`)
    return response.data
  },

  // React-Konva를 사용한 썸네일 생성 (렌더 프로세스에서 직접 처리)
  generateThumbnailWithKonva: async (request: ThumbnailKonvaRequest): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 렌더 프로세스에서 직접 처리하므로 별도 API 호출 불필요
      // 대신 컴포넌트를 동적으로 생성하여 썸네일 추출

      try {
        // React 컴포넌트를 동적으로 렌더링하여 썸네일 생성
        // 이 부분은 실제 사용할 때 구현
        resolve('data:image/png;base64,...') // 임시 반환값
      } catch (error) {
        reject(error)
      }
    })
  },

  // 메인 프로세스에 React-Konva 썸네일 생성 요청
  requestKonvaThumbnailGeneration: async (contentHtml: string): Promise<string> => {
    try {
      // IPC를 통해 메인 프로세스에서 렌더 프로세스로 썸네일 생성 요청
      const result = await window.electronAPI.invoke('generate-konva-thumbnail', { contentHtml })
      return result.thumbnailUrl || null
    } catch (error) {
      console.error('Konva 썸네일 생성 요청 실패:', error)
      throw error
    }
  },
}
