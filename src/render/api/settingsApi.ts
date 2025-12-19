import type { AppSettings } from '../types/settings'
import { api } from './apiClient'

export type AiModelListResponse = {
  defaultModel: string
  models: { id: string; label: string }[]
}

export const getSettings = async (): Promise<AppSettings> => {
  const response = await api.get('/settings')
  return response.data
}

export const getAiModels = async (): Promise<AiModelListResponse> => {
  const response = await api.get('/settings/ai/models')
  return response.data
}

export const updateSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  const response = await api.post('/settings', settings)
  return response.data
}

export const uploadProxyExcel = async (file: File): Promise<{ success: boolean; count?: number; message?: string }> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/settings/proxies/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export const downloadProxySampleExcel = async (): Promise<Blob> => {
  const response = await api.get('/settings/proxies/sample-excel', { responseType: 'blob' })
  return response.data
}
