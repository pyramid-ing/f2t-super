export interface WordPressAccount {
  id: number
  name: string
  desc?: string
  url: string
  wpUsername: string
  apiKey: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface WordPressPost {
  title: string
  content: string
  status: string
  categories?: number[]
  tags?: number[]
  featuredMediaId?: number
}
