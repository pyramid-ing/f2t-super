export interface SitemapUrl {
  loc: string
  lastmod?: string
}

export interface IndexingConfig {
  mode: 'recentCount' | 'recentDays' | 'fromDate' | 'all'
  count?: number
  days?: number
  startDate?: string
}

export interface SitemapConfig {
  id: string
  siteId: number
  name: string
  sitemapType: string
  isEnabled: boolean
  lastParsed?: Date
  createdAt: Date
  updatedAt: Date
  site: Site
}

export interface Site {
  id: number
  name: string
  domain: string
  siteUrl: string
  description?: string
  isActive: boolean
  googleConfig: string
  naverConfig: string
  daumConfig: string
  bingConfig: string
  indexingConfig: string
  createdAt: Date
  updatedAt: Date
}

export interface SitemapProcessor {
  canProcess(sitemapType: string): boolean
  processSitemap(xmlText: string, baseUrl: string, indexingConfig?: IndexingConfig): Promise<SitemapUrl[]>
}

export interface EngineConfig {
  use: boolean
  [key: string]: any
}

export interface CreateSitemapConfigDto {
  name: string
  sitemapType: string
  isEnabled?: boolean
}

export interface UpdateSitemapConfigDto {
  name?: string
  sitemapType?: string
  isEnabled?: boolean
}

export interface CreateIndexJobDto {
  url: string
  provider: string
  siteId: number
}

export interface SitemapParseResult {
  message: string
  processedUrls: number
  newUrls: number
}

// XML 데이터 타입들
export interface SitemapItem {
  loc?: string
  'sitemap:loc'?: string
  lastmod?: string
  'sitemap:lastmod'?: string
}

export interface UrlItem {
  loc?: string
  'sitemap:loc'?: string
  lastmod?: string
  'sitemap:lastmod'?: string
}

export interface RssItem {
  link?: string
  url?: string
  pubDate?: string
  published?: string
}

export interface XmlData {
  sitemapindex?: {
    sitemap: SitemapItem | SitemapItem[]
  }
  'sitemap:sitemapindex'?: {
    'sitemap:sitemap': SitemapItem | SitemapItem[]
  }
  urlset?: {
    url: UrlItem | UrlItem[]
  }
  'sitemap:urlset'?: {
    'sitemap:url': UrlItem | UrlItem[]
  }
  rss?: {
    channel?: {
      item: RssItem | RssItem[]
    }
  }
  feed?: {
    entry: RssItem | RssItem[]
  }
  [key: string]: any
}
