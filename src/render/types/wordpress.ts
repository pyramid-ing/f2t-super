export interface WordPressAccount {
  id: number
  name: string
  desc?: string
  url: string
  wpUsername: string
  apiKey: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateWordPressAccountDto {
  name: string
  desc?: string
  url: string
  wpUsername: string
  apiKey: string
  isDefault: boolean
}

export interface UpdateWordPressAccountDto {
  name?: string
  desc?: string
  url?: string
  wpUsername?: string
  apiKey?: string
  isDefault?: boolean
}
