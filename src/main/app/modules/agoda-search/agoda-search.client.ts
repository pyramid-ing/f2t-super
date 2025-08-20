import axios, { AxiosInstance } from 'axios'
import { AgodaSearchRequestBody, AgodaSearchResponse } from './agoda-search.types'
import { SettingsService } from '@main/app/modules/settings/settings.service'

export class AgodaSearchClient {
  private axios: AxiosInstance

  constructor(
    private readonly settingsService: SettingsService,
    private baseUrl = process.env.AGODA_JSON_SEARCH_URL!,
    private siteId = process.env.AGODA_SITE_ID!,
    private apiKey = process.env.AGODA_API_KEY!,
    private timeoutMs = 15000,
  ) {
    if (!this.baseUrl || !this.siteId || !this.apiKey) {
      throw new Error('AGODA_JSON_SEARCH_URL, AGODA_SITE_ID, AGODA_API_KEY 환경변수를 설정하세요.')
    }

    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${this.siteId}:${this.apiKey}`,
      },
    })
  }

  public async search(body: AgodaSearchRequestBody): Promise<AgodaSearchResponse> {
    this.validateRequest(body)

    const maxRetry = 2
    let lastErr: any

    for (let attempt = 0; attempt <= maxRetry; attempt++) {
      try {
        const res = await this.axios.post<AgodaSearchResponse>('', body)
        return res.data
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 401 || status === 403) {
          throw new Error(`Agoda Search 인증 실패(HTTP ${status}). siteId/apiKey/Authorization 헤더를 확인하세요.`)
        }
        if (status === 429 || (status >= 500 && status < 600)) {
          lastErr = err
          await this.backoff(attempt)
          continue
        }
        throw err
      }
    }
    throw lastErr ?? new Error('Agoda Search 재시도 실패')
  }

  private validateRequest(body: AgodaSearchRequestBody) {
    const c = body.criteria
    if (!Array.isArray(c.propertyIds) || c.propertyIds.length === 0) {
      throw new Error('criteria.propertyIds는 최소 1개가 필요합니다.')
    }
    if (c.children > 0) {
      if (!Array.isArray(c.childrenAges) || c.childrenAges.length !== c.children) {
        throw new Error('children > 0이면 childrenAges 길이가 children과 같아야 하며 빈 배열을 보낼 수 없습니다.')
      }
      const invalid = c.childrenAges.some(a => a < 0 || a > 200)
      if (invalid) throw new Error('childrenAges는 0~200 범위여야 합니다.')
    }

    if (body.features?.ratesPerProperty && c.propertyIds.length > 1) {
      const n = c.propertyIds.length
      const r = body.features.ratesPerProperty
      if (n >= 2 && n <= 30 && r > 25) {
        console.warn('2~30개 HID 요청 시 ratesPerProperty는 최대 25입니다.')
      }
      if (n >= 31 && r > 1) {
        console.warn('31~100개 HID 요청 시 ratesPerProperty는 1만 허용됩니다.')
      }
    }
  }

  private async backoff(attempt: number) {
    const ms = 500 * Math.pow(2, attempt)
    await new Promise(r => setTimeout(r, ms))
  }
}
