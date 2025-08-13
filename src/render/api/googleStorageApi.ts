import { api } from './apiClient'

export async function createGcsBucket(
  bucketName: string,
): Promise<{ status: string; message: string; bucketName?: string; error?: string }> {
  const response = await api.post('/storage/create-bucket', { bucketName })
  return response.data
}
