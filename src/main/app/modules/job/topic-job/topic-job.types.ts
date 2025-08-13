export interface TopicResult {
  title: string
  content: string
}

export interface TopicJobResult {
  resultMsg: string
  topics: TopicResult[]
}

export interface CreateTopicJobDto {
  topic: string
  limit: number
}

export interface TopicJobResponse {
  id: string
  topic: string
  limit: number
  status: 'draft' | 'completed' | 'failed'
  result?: TopicResult[]
  xlsxFileName?: string
  createdAt: Date
  updatedAt: Date
}
