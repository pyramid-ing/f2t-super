export type AIProvider = 'gemini'

export interface AppSettings {
  // Google OAuth 관련 설정 (토큰 정보만)
  oauth2AccessToken?: string
  oauth2TokenExpiry?: string
  oauth2RefreshToken?: string
  bloggerBlogName?: string // 선택된 Blogger 블로그 이름

  // AI 설정
  aiProvider: AIProvider
  geminiApiKey?: string

  // 쿠팡 파트너스 설정
  coupangPartner?: {
    apiKey?: string
    secretKey?: string
  }

  // 이미지 설정
  imageType?: 'ai' | 'pixabay' | 'none' // 이미지 생성 방식 (none: 사용안함)
  pixabayApiKey?: string // Pixabay API 키

  // 썸네일 설정
  thumbnailEnabled?: boolean // 썸네일 생성 활성화 여부
  thumbnailBackgroundImage?: string // 썸네일 배경이미지 파일명 (deprecated)
  thumbnailDefaultLayoutId?: string // 기본 썸네일 레이아웃 ID
  thumbnailTextColor?: string // 썸네일 텍스트 색상
  thumbnailFontSize?: number // 썸네일 폰트 크기
  thumbnailFontFamily?: string // 썸네일 폰트 패밀리

  // GCS 설정
  gcsKeyContent?: string // GCS 서비스 계정 키 JSON 내용
  gcsBucketName?: string // GCS 버킷명

  // 광고 설정
  adEnabled?: boolean // 광고 활성화 여부
  adScript?: string // 광고 스크립트 코드

  // 링크 설정
  linkEnabled?: boolean // 링크 활성화 여부
  youtubeEnabled?: boolean // 유튜브 링크 활성화 여부

  // 기존 설정들...
  blogId?: string
  blogName?: string
  blogUrl?: string
  googleAccessToken?: string
  googleRefreshToken?: string
  googleTokenExpiry?: number
}

export interface AISettings {
  geminiApiKey?: string
  aiProvider: AIProvider
}
