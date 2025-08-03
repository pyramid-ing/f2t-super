import { CreateWordPressAccountDto, UpdateWordPressAccountDto, WordPressAccount } from '@render/types/wordpress'
import { api } from './apiClient'

// 계정 목록 조회
export async function getWordPressAccounts() {
  const response = await api.get<WordPressAccount[]>('/wordpress/accounts')
  return response.data
}

// 기본 계정 조회
export async function getWordPressDefaultAccount() {
  const response = await api.get<WordPressAccount | null>('/wordpress/accounts/default')
  return response.data
}

// 계정 생성
export async function createWordPressAccount(accountData: CreateWordPressAccountDto) {
  const response = await api.post<WordPressAccount>('/wordpress/accounts', accountData)
  return response.data
}

// 계정 수정
export async function updateWordPressAccount(id: number, accountData: UpdateWordPressAccountDto) {
  const response = await api.put<WordPressAccount>(`/wordpress/accounts/${id}`, accountData)
  return response.data
}

// 계정 삭제
export async function deleteWordPressAccount(id: number) {
  await api.delete(`/wordpress/accounts/${id}`)
}
