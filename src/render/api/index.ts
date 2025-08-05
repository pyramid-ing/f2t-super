// 도메인별 API export만 남기고, 기존 함수 구현은 모두 제거합니다.
export { api } from './apiClient'
export * from './error.type'
export * from './errorHelpers'
export * from './settingsApi'
export * from './googleOAuthApi'
export * from './googleBlogApi'
export * from './googleStorageApi'
export * from './tistoryApi'
export * from './wordpressApi'
export * from './jobApi'
export * from './workflowApi'
export * from './thumbnailApi'
export * from './coupangPartnersApi'
export * from './coupangBlogPostJobApi'
export * from './authApi'

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}
