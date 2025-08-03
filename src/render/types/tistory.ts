export interface TistoryAccount {
  id: number
  name: string
  desc?: string
  tistoryUrl: string
  loginId: string
  loginPassword: string
  isDefault: boolean
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
}

export interface UpdateTistoryAccountDto {
  name?: string
  desc?: string
  tistoryUrl?: string
  loginId?: string
  loginPassword?: string
  isDefault?: boolean
}
