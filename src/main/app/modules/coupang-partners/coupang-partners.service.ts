import axios, { AxiosInstance } from 'axios'
import * as crypto from 'crypto'
import { format } from 'date-fns'
import { Injectable, Logger } from '@nestjs/common'
import { retry } from '../../utils/retry'
import { SettingsService } from '../settings/settings.service'
import {
  CoupangPartnersConfig,
  CoupangDeeplinkRequest,
  CoupangDeeplinkResponse,
  CoupangAffiliateLink,
} from './coupang-partners.types'

// CoupangPartnersError 클래스 정의
class CoupangPartnersErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'CoupangPartnersError'
  }
}

@Injectable()
export class CoupangPartnersService {
  private readonly logger = new Logger(CoupangPartnersService.name)
  private readonly httpClient: AxiosInstance
  private config: CoupangPartnersConfig | null = null

  constructor(private readonly settingsService: SettingsService) {
    this.httpClient = axios.create({
      baseURL: 'https://api-gateway.coupang.com',
      timeout: 30000,
    })

    // 요청 인터셉터 추가
    this.httpClient.interceptors.request.use(
      config => {
        this.logger.debug(`쿠팡 API 요청: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      error => {
        this.logger.error('쿠팡 API 요청 오류:', error)
        return Promise.reject(error)
      },
    )

    // 응답 인터셉터 추가
    this.httpClient.interceptors.response.use(
      response => {
        this.logger.debug(`쿠팡 API 응답: ${response.status}`)
        return response
      },
      error => {
        this.logger.error('쿠팡 API 응답 오류:', error.response?.data || error.message)
        return Promise.reject(error)
      },
    )
  }

  /**
   * 설정에서 쿠팡 파트너스 설정을 가져옵니다.
   */
  private async getConfig(): Promise<CoupangPartnersConfig> {
    if (this.config) {
      return this.config
    }

    const settings = await this.settingsService.getSettings()
    this.config = {
      accessKey: settings.coupangAccessKey || '',
      secretKey: settings.coupangSecretKey || '',
      baseUrl: 'https://api-gateway.coupang.com',
    }

    return this.config
  }

  /**
   * 캐시된 설정을 초기화합니다.
   */
  clearConfigCache(): void {
    this.config = null
  }

  /**
   * Coupang Partners HMAC 서명 생성
   */
  private generateSignature(
    method: 'POST' | 'GET',
    pathWithQuery: string,
    secretKey: string,
    accessKey: string,
  ): string {
    const [path, query = ''] = pathWithQuery.split('?')
    const date = format(new Date(), "yyMMdd'T'HHmmss'Z'")
    const msg = `${date}${method}${path}${query}`

    const signature = crypto.createHmac('sha256', secretKey).update(msg).digest('hex')

    return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${date}, signature=${signature}`
  }

  /**
   * 쿠팡 어필리에이트 링크 생성
   */
  async createAffiliateLink(coupangUrl: string): Promise<CoupangAffiliateLink> {
    const config = await this.getConfig()

    if (!config.accessKey || !config.secretKey) {
      throw new Error('쿠팡 파트너스 API 키가 설정되지 않았습니다.')
    }

    const endpoint = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink'
    const authorization = this.generateSignature('POST', endpoint, config.secretKey, config.accessKey)

    const requestData: CoupangDeeplinkRequest = {
      coupangUrls: [coupangUrl],
    }

    try {
      const response = await retry(async () => {
        const result = await this.httpClient.post<CoupangDeeplinkResponse>(endpoint, requestData, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
          },
        })

        if (result.data.rCode !== '0') {
          throw new Error(`쿠팡 API 오류 ${result.data.rCode}: ${result.data.rMessage}`)
        }

        return result.data
      }, 3)

      const affiliateData = response.data[0]
      return {
        originalUrl: affiliateData.originalUrl,
        shortenUrl: affiliateData.shortenUrl,
        landingUrl: affiliateData.landingUrl,
      }
    } catch (error) {
      this.logger.error('어필리에이트 링크 생성 실패:', error)
      throw new CoupangPartnersErrorClass({
        code: 'AFFILIATE_LINK_CREATION_FAILED',
        message: '어필리에이트 링크 생성에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * API 키 유효성 검증
   */
  async validateApiKeys(): Promise<boolean> {
    try {
      const config = await this.getConfig()

      if (!config.accessKey || !config.secretKey) {
        return false
      }

      // 간단한 API 호출로 키 유효성 검증
      await this.createAffiliateLink('https://www.coupang.com/vp/products/test')
      return true
    } catch (error) {
      this.logger.error('API 키 유효성 검증 실패:', error)
      return false
    }
  }

  /**
   * 설정 정보 반환
   */
  async getConfigInfo(): Promise<CoupangPartnersConfig> {
    const config = await this.getConfig()
    return {
      ...config,
      secretKey: '***', // 보안상 마스킹
    }
  }
}
