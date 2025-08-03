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

export async function convertTopicToBlogPost(
  topicJobId: string,
  selectedTopics: number[],
  platform: 'blogger' | 'wordpress' | 'tistory',
  accountId?: string,
) {
  const response = await api.post('/topic-job/convert-to-blog-post', {
    topicJobId,
    selectedTopics,
    platform,
    accountId,
  })
  return response.data
}

export async function improveTopicQuality(topic: { title: string; content: string }) {
  const response = await api.post('/topic-job/improve-quality', { topic })
  return response.data
}

export async function classifyTopic(topic: { title: string; content: string }) {
  const response = await api.post('/topic-job/classify', { topic })
  return response.data
}
