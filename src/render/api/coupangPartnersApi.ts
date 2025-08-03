import { api } from './apiClient'

export interface CoupangAffiliateLink {
  originalUrl: string
  shortenUrl: string
  landingUrl: string
}

export interface CoupangProductInfo {
  title: string
  price: number
  originalUrl: string
  affiliateUrl: string
  images: string[]
  reviews: {
    positive: CoupangReview[]
    negative: CoupangReview[]
  }
}

export interface CoupangReview {
  content: string
  rating: number
  author: string
  date: string
}

export interface CreateAffiliateLinkRequest {
  coupangUrl: string
}

export interface GetProductInfoRequest {
  coupangUrl: string
}

export const coupangPartnersApi = {
  /**
   * 어필리에이트 링크 생성
   */
  createAffiliateLink: async (data: CreateAffiliateLinkRequest): Promise<CoupangAffiliateLink> => {
    const response = await api.post('/coupang-partners/affiliate-link', data)
    return response.data
  },

  /**
   * 상품 정보 수집
   */
  getProductInfo: async (data: GetProductInfoRequest): Promise<CoupangProductInfo> => {
    const response = await api.post('/coupang-partners/product-info', data)
    return response.data
  },

  /**
   * API 키 유효성 검증
   */
  validateApiKeys: async (): Promise<{ isValid: boolean }> => {
    const response = await api.get('/coupang-partners/validate-keys')
    return response.data
  },

  /**
   * 설정 정보 조회
   */
  getConfig: async () => {
    const response = await api.get('/coupang-partners/config')
    return response.data
  },
}
