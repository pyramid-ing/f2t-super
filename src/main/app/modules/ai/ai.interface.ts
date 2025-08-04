import { SearchResultItem } from '../search/searxng.service'

export interface ThumbnailData {
  mainText: string
  subText?: string
  keywords: string[]
}

export interface Topic {
  title: string
  content: string
}

// Define the TypeScript interface based on the JSON schema
export interface BlogOutline {
  title: string
  sections: {
    index: number // 섹션 순서
    title: string // 제목
    summary: string // 요약
    length: string // 예상 글자 수 (ex: '250자')
  }[]
}

// Define the TypeScript interface based on the new JSON schema
export interface BlogPost {
  thumbnailUrl?: string
  seo?: string // jsonLd
  sections: {
    html: string // HTML content for each section
    imageUrl?: string // Optional image URL for each section
    links?: LinkResult[] // Optional related links for each section
    youtubeLinks?: YoutubeResult[] // Optional YouTube links for each section
    aiImagePrompt?: string // Optional AI image prompt for each section
    adHtml?: string // Optional advertisement HTML for each section
  }[]
}
export interface AIService {
  /**
   * AI 서비스 초기화 및 설정
   */
  initialize(): Promise<void>

  /**
   * SEO에 최적화된 제목 생성
   */
  generateTopics(topic: string, limit: number): Promise<Topic[]>

  generateBlogOutline(title: string, description: string): Promise<BlogOutline>

  generateBlogPost(blogOutline: BlogOutline): Promise<BlogPost>

  /**
   * 이미지 생성을 위한 프롬프트 생성
   */
  generateAiImagePrompt(html: string): Promise<string>

  /**
   * Pixabay 검색을 위한 키워드 생성
   * @returns 관련성 높은 순서대로 정렬된 5개의 키워드 배열
   */
  generatePixabayPrompt(html: string): Promise<string[]>

  /**
   * AI를 사용한 이미지 생성
   */
  generateImage(prompt: string): Promise<string>

  /**
   * 썸네일 텍스트 데이터 생성
   */
  generateThumbnailData(content: string): Promise<ThumbnailData>

  /**
   * API 키 유효성 검증
   */
  validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }>

  generateLinkSearchPrompt(html: string): Promise<string>

  /**
   * (섹션 제목 포함) 본문+제목 기반 관련 링크 검색어 생성
   */
  generateLinkSearchPromptWithTitle(html: string, title: string): Promise<string>

  generateYoutubeSearchPrompt(html: string): Promise<string>

  /**
   * 링크 제목을 AI로 요약/가공
   */
  generateLinkTitle(title: string, content: string): Promise<string>

  /**
   * 여러 후보 링크 중 본문에 가장 적합한 링크 1개를 AI로 선정
   */
  pickBestLinkByAI(html: string, candidates: SearchResultItem[]): Promise<SearchResultItem | null>
}

export interface LinkResult {
  name: string
  link: string
}

export interface YoutubeResult {
  title: string
  videoId: string
  url: string
}

export interface GeminiQuotaError {
  error: {
    code: number
    message: string
    status: string
    details: Array<{
      '@type': string
      violations?: Array<{
        quotaMetric: string
        quotaId: string
        quotaDimensions: {
          location: string
          model: string
        }
        quotaValue: string
      }>
      links?: Array<{
        description: string
        url: string
      }>
      retryDelay?: string
    }>
  }
}

export class AIQuotaExceededError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
    public readonly provider: string,
  ) {
    super(message)
    this.name = 'AIQuotaExceededError'
  }
}
