export interface BingIndexerOptions {
  url?: string
  urls?: string[]
  siteId: number
}

export interface BingSubmitPayload {
  siteUrl: string
  urlList: string[]
}
