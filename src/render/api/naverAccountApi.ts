import { api } from '@render/api/apiClient'

export interface NaverAccount {
  id: number
  name: string
  naverId: string
  password: string
  isActive: boolean
  isLoggedIn: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export type NaverLoginStatus = {
  isLoggedIn: boolean
  needsLogin: boolean
  message: string
}

export type CreateNaverAccountDto = Pick<NaverAccount, 'name' | 'naverId' | 'password'> & { isActive?: boolean }

export async function getAllNaverAccounts(): Promise<NaverAccount[]> {
  const res = await api.get<NaverAccount[]>('/naver-accounts')
  return res.data
}

export async function createNaverAccount(data: CreateNaverAccountDto): Promise<NaverAccount> {
  const res = await api.post<NaverAccount>('/naver-accounts', data)
  return res.data
}

export async function updateNaverAccount(id: number, data: Partial<NaverAccount>): Promise<NaverAccount> {
  const res = await api.patch<NaverAccount>(`/naver-accounts/${id}`, data)
  return res.data
}

export async function deleteNaverAccount(id: number): Promise<void> {
  await api.delete(`/naver-accounts/${id}`)
}
