export interface TistoryAccount {
  id: number
  name: string
  desc?: string
  tistoryUrl: string
  loginId: string
  loginPassword: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TistoryPost {
  title: string
  content: string
  category?: string
  tags?: string[]
  visibility?: 'public' | 'private' | 'protected'
}

export interface TistoryPostOptions {
  title: string
  contentHtml: string
  url: string
  keywords: string[]
  category?: string // 카테고리명(선택)
  imagePaths?: string[] // 첨부할 이미지 경로 배열(선택)
  kakaoId?: string // 카카오 아이디(선택)
  kakaoPw?: string // 카카오 비번(선택)
  postVisibility?: 'public' | 'private' | 'protected' // 공개범위(선택)
}
