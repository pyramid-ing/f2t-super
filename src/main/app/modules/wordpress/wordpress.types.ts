export interface WordPressAccount {
  id: number
  name: string
  desc?: string
  url: string
  apiKey: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface WordPressPost {
  title: string
  content: string
  categories?: number[]
  tags?: string[]
  featuredImage?: string
}
