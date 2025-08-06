import axios, { AxiosInstance } from 'axios'
import * as crypto from 'crypto'
import { Injectable, Logger } from '@nestjs/common'
import { retry } from '../../utils/retry'
import { SettingsService } from '../settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { assertPermission } from '@main/app/utils/permission.assert'
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
   * 권한 체크
   */
  private async checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()
    assertPermission(settings.licenseCache, permission)
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
      accessKey: settings.coupangPartner.apiKey || '',
      secretKey: settings.coupangPartner.secretKey || '',
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

    // UTC 시간을 사용하여 서명 생성 (YYMMDDTHHmmssZ 형식)
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

    // 서명할 문자열 생성
    const stringToSign = `${method} ${path}?${query}\n${timestamp}\n${accessKey}`

    // HMAC-SHA256 서명 생성
    const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('base64')

    return signature
  }

  /**
   * 어필리에이트 링크 생성
   */
  async createAffiliateLink(coupangUrl: string, subId?: string): Promise<CoupangAffiliateLink> {
    await this.checkPermission(Permission.USE_COUPANG_PARTNERS)

    try {
      const config = await this.getConfig()

      if (!config.accessKey || !config.secretKey) {
        throw new CoupangPartnersErrorClass({
          code: 'CONFIG_MISSING',
          message: '쿠팡 파트너스 API 키가 설정되지 않았습니다.',
        })
      }

      // 쿠팡 URL에서 상품 ID 추출
      const productId = this.extractProductId(coupangUrl)
      if (!productId) {
        throw new CoupangPartnersErrorClass({
          code: 'INVALID_URL',
          message: '유효하지 않은 쿠팡 URL입니다.',
        })
      }

      const requestData: CoupangDeeplinkRequest = {
        coupangUrls: [coupangUrl],
        subId: subId || 'f2t-super',
      }

      const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink'
      const query = `subId=${requestData.subId}`
      const signature = this.generateSignature('POST', `${path}?${query}`, config.secretKey, config.accessKey)
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

      const response = await retry(
        () =>
          this.httpClient.post<CoupangDeeplinkResponse>(`${path}?${query}`, requestData, {
            headers: {
              Authorization: `CEA algorithm=HmacSHA256, access-key=${config.accessKey}, signed-date=${timestamp}, signature=${signature}`,
              'Content-Type': 'application/json',
              'X-Timestamp': timestamp,
            },
          }),
        1000,
        3,
        'exponential',
      )

      if (response.data.rCode !== '0') {
        throw new CoupangPartnersErrorClass({
          code: 'API_ERROR',
          message: `쿠팡 API 오류: ${response.data.rMessage}`,
          details: response.data,
        })
      }

      const affiliateLink = response.data.data[0]
      return {
        originalUrl: coupangUrl,
        shortenUrl: affiliateLink.shortenUrl,
        landingUrl: affiliateLink.landingUrl,
      }
    } catch (error) {
      if (error instanceof CoupangPartnersErrorClass) {
        throw error
      }

      this.logger.error('어필리에이트 링크 생성 실패:', error)
      throw new CoupangPartnersErrorClass({
        code: 'AFFILIATE_LINK_CREATION_FAILED',
        message: '어필리에이트 링크 생성에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 쿠팡 URL에서 상품 ID 추출
   */
  private extractProductId(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')
      const productIndex = pathParts.findIndex(part => part === 'products')

      if (productIndex !== -1 && pathParts[productIndex + 1]) {
        return pathParts[productIndex + 1]
      }

      return null
    } catch (error) {
      return null
    }
  }

  /**
   * API 키 유효성 검증
   */
  async validateApiKeys(): Promise<boolean> {
    await this.checkPermission(Permission.USE_COUPANG_PARTNERS)

    try {
      const config = await this.getConfig()

      if (!config.accessKey || !config.secretKey) {
        return false
      }

      // 간단한 API 호출로 키 유효성 검증
      const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink'
      const query = 'subId=test'
      const signature = this.generateSignature('POST', `${path}?${query}`, config.secretKey, config.accessKey)
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

      await this.httpClient.post(
        `${path}?${query}`,
        { coupangUrls: ['https://www.coupang.com/vp/products/test'] },
        {
          headers: {
            Authorization: `CEA algorithm=HmacSHA256, access-key=${config.accessKey}, signed-date=${timestamp}, signature=${signature}`,
            'Content-Type': 'application/json',
            'X-Timestamp': timestamp,
          },
        },
      )

      return true
    } catch (error) {
      this.logger.error('API 키 유효성 검증 실패:', error)
      return false
    }
  }

  /**
   * 설정 정보 조회
   */
  async getConfigInfo(): Promise<CoupangPartnersConfig> {
    await this.checkPermission(Permission.USE_COUPANG_PARTNERS)

    const config = await this.getConfig()
    return {
      accessKey: config.accessKey ? '***' + config.accessKey.slice(-4) : '',
      secretKey: config.secretKey ? '***' + config.secretKey.slice(-4) : '',
      baseUrl: config.baseUrl,
    }
  }
}
