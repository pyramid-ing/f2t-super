import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

export interface SearchResultItem {
  url: string
  title: string
  content: string
}

export interface SearchResponse {
  query: string
  number_of_results: number
  results: SearchResultItem[]
}

@Injectable()
export class SearxngService {
  private readonly logger = new Logger(SearxngService.name)
  private readonly baseUrl = 'https://searxng.pyramid-ing.com/search'

  async search(query: string, engine: string = 'google', numResults: number = 10): Promise<SearchResponse> {
    try {
      const url = new URL(this.baseUrl)
      url.searchParams.set('q', query)
      url.searchParams.set('format', 'json')
      url.searchParams.set('num_results', numResults.toString())
      url.searchParams.set('engines', engine)

      const resp = await axios.get<SearchResponse>(url.toString())
      return resp.data
    } catch (error) {
      this.logger.error('Searxng 검색 실패:', error)
      throw new CustomHttpException(ErrorCode.SEARXNG_SEARCH_FAILED)
    }
  }
}
