import { api } from '@render/api/apiClient'

const BASE_PATH = '/sites'

export interface Site {
  id: number
  name: string
  domain: string
  siteUrl: string
  isActive: boolean
  naverConfig: {
    use: boolean
    selectedNaverAccountId?: number
    headless?: boolean
  }
  daumConfig: {
    use: boolean
    siteUrl?: string
    password?: string
    headless?: boolean
  }
  googleConfig: {
    use: boolean
    serviceAccountJson?: string
  }
  bingConfig: {
    use: boolean
    apiKey?: string
  }
}

// 사이트 설정 관리 API
export async function getAllSites(): Promise<Site[]> {
  const res = await api.get<Site[]>(BASE_PATH)
  return res.data
}

export async function getSiteById(id: number): Promise<Site> {
  const res = await api.get<Site>(`${BASE_PATH}/${id}`)
  return res.data
}

export async function createSite(data: Omit<Site, 'id'>): Promise<Site> {
  const res = await api.post<Site>(BASE_PATH, data)
  return res.data
}

export async function updateSite(id: number, data: Partial<Site>): Promise<Site> {
  const res = await api.put<Site>(`${BASE_PATH}/${id}`, data)
  return res.data
}

export async function deleteSite(id: number): Promise<void> {
  await api.delete(`${BASE_PATH}/${id}`)
}

export async function getSiteByDomain(domain: string): Promise<Site> {
  const res = await api.get<Site>(`${BASE_PATH}/domain/${encodeURIComponent(domain)}`)
  return res.data
}

export async function getActiveSites(): Promise<Site[]> {
  const res = await api.get<Site[]>(`${BASE_PATH}/active`)
  return res.data
}

// 전역 설정 관리 API
export async function getGlobalSettings(): Promise<any> {
  const res = await api.get('/settings')
  return res.data
}

export async function updateGlobalSettings(data: any): Promise<any> {
  const res = await api.put('/settings', data)
  return res.data
}

export async function updateAiSettings(data: any): Promise<any> {
  const res = await api.put('/settings/ai', data)
  return res.data
}
