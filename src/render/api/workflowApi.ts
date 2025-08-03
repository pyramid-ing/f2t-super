import { api } from './apiClient'

export async function addTopicJob(topic: string, limit: number = 10) {
  const response = await api.get('/workflow/find-topics', {
    params: { topic, limit },
  })
  return response.data
}

export async function registerWorkflow(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/workflow/post', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}
