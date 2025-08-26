export enum WordPressVisibility {
  PUBLISH = 'publish',
  PRIVATE = 'private',
}

export interface WordPressAccount {
  id: number
  name: string
  desc?: string
  url: string
  wpUsername: string
  apiKey: string
  isDefault: boolean
  defaultVisibility?: WordPressVisibility
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
  defaultVisibility?: WordPressVisibility
}

export interface UpdateWordPressAccountDto {
  name?: string
  desc?: string
  url?: string
  wpUsername?: string
  apiKey?: string
  isDefault?: boolean
  defaultVisibility?: WordPressVisibility
}
