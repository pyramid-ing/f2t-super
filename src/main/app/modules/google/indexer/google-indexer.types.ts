export interface GoogleIndexerOptions {
  url?: string
  urls?: string[]
  siteUrl: string
  type?: 'URL_UPDATED' | 'URL_DELETED'
}
