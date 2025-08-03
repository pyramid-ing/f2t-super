import type { AppSettings } from '../types/settings'
import { api } from './apiClient'
import { ValidateAIKeyResponseDto } from '@main/app/modules/settings/dto/validate-ai-key.dto'

export async function validatePerplexityApiKey(apiKey: string): Promise<{
  valid: boolean
  error?: string
  model?: string
}> {
  const res = await api.post('/settings/validate-perplexity-key', { apiKey })
  return res.data
}

export const getSettings = async (): Promise<AppSettings> => {
  const response = await api.get('/settings')
  return response.data
}

export const updateSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  const response = await api.post('/settings', settings)
  return response.data
}

export const validateAIKey = async ({
  provider,
  apiKey,
}: {
  provider: 'openai' | 'gemini' | 'perplexity'
  apiKey: string
}) => {
  const response = await api.post<ValidateAIKeyResponseDto>('/ai/validate-key', {
    provider,
    apiKey,
  })
  return response.data
}

export const validateCoupangKeys = async ({ accessKey, secretKey }: { accessKey: string; secretKey: string }) => {
  const response = await api.post('/coupang-partners/validate-keys', {
    accessKey,
    secretKey,
  })
  return response.data
}
