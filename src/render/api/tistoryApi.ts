import { CreateTistoryAccountDto, TistoryAccount, UpdateTistoryAccountDto } from '@render/types/tistory'
import { api } from './apiClient'

// 계정 목록 조회
export async function getTistoryAccounts() {
  const response = await api.get<TistoryAccount[]>('/tistory/accounts')
  return response.data
}

// 기본 계정 조회
export async function getTistoryDefaultAccount() {
  const response = await api.get<TistoryAccount | null>('/tistory/accounts/default')
  return response.data
}

// 계정 생성
export async function createTistoryAccount(accountData: CreateTistoryAccountDto) {
  const response = await api.post<TistoryAccount>('/tistory/accounts', accountData)
  return response.data
}

// 계정 수정
export async function updateTistoryAccount(id: number, accountData: UpdateTistoryAccountDto) {
  const response = await api.put<TistoryAccount>(`/tistory/accounts/${id}`, accountData)
  return response.data
}

// 계정 삭제
export async function deleteTistoryAccount(id: number) {
  await api.delete(`/tistory/accounts/${id}`)
}
