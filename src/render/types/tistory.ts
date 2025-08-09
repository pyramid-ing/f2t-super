export interface TistoryAccount {
  id: number
  name: string
  desc?: string
  tistoryUrl: string
  loginId: string
  loginPassword: string
  isDefault: boolean
  defaultVisibility?: 'public' | 'private'
  createdAt: string
  updatedAt: string
}

export interface CreateTistoryAccountDto {
  name: string
  desc?: string
  tistoryUrl: string
  loginId: string
  loginPassword: string
  isDefault: boolean
  defaultVisibility?: 'public' | 'private'
}

export interface UpdateTistoryAccountDto {
  name?: string
  desc?: string
  tistoryUrl?: string
  loginId?: string
  loginPassword?: string
  isDefault?: boolean
  defaultVisibility?: 'public' | 'private'
}
