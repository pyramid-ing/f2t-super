export interface WordPressAccount {
  id: number
  name: string
  desc?: string
  url: string
  wpUsername: string
  apiKey: string
  isDefault: boolean
  defaultVisibility?: 'publish' | 'private'
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
  defaultVisibility?: 'publish' | 'private'
}

export interface UpdateWordPressAccountDto {
  name?: string
  desc?: string
  url?: string
  wpUsername?: string
  apiKey?: string
  isDefault?: boolean
  defaultVisibility?: 'publish' | 'private'
}
