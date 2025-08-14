import axios, { AxiosInstance } from 'axios'
import * as crypto from 'crypto'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { Injectable, Logger } from '@nestjs/common'
import { retry } from '@main/app/utils'
import { SettingsService } from '../settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { assertPermission } from '@main/app/utils/permission.assert'
import {
  CoupangPartnersConfig,
  CoupangDeeplinkRequest,
  CoupangDeeplinkResponse,
  CoupangAffiliateLink,
} from './coupang-partners.types'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

// dayjs UTC 플러그인 활성화
dayjs.extend(utc)

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
      accessKey: settings.coupangPartner?.apiKey || '',
      secretKey: settings.coupangPartner?.secretKey || '',
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
   * 쿠팡 파트너스 API용 HMAC 서명 생성 (공식 예제 기반)
   */
  private generateHmac(method: 'POST' | 'GET', url: string, secretKey: string, accessKey: string): string {
    const parts = url.split(/\?/)
    const [path, query = ''] = parts

    const datetime = dayjs.utc().format('YYMMDD[T]HHmmss[Z]')
    const message = datetime + method + path + query

    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex')

    return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`
  }

  /**
   * 어필리에이트 링크 생성
   */
  async createAffiliateLink(coupangUrl: string, subId?: string): Promise<CoupangAffiliateLink> {
    await this.checkPermission(Permission.USE_COUPANG_PARTNERS)

    try {
      const config = await this.getConfig()

      if (!config.accessKey || !config.secretKey) {
        throw new CustomHttpException(ErrorCode.COUPANG_PARTNERS_CONFIG_REQUIRED)
      }

      // 쿠팡 URL에서 상품 ID 추출
      const productId = this.extractProductId(coupangUrl)
      if (!productId) {
        throw new CustomHttpException(ErrorCode.COUPANG_PARTNERS_INVALID_URL)
      }

      const requestData: CoupangDeeplinkRequest = {
        coupangUrls: [coupangUrl],
        subId: subId || 'f2t-super',
      }

      const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink'
      const query = `subId=${requestData.subId}`
      const authorization = this.generateHmac('POST', `${path}?${query}`, config.secretKey, config.accessKey)

      const response = await retry(
        () =>
          this.httpClient.post<CoupangDeeplinkResponse>(`${path}?${query}`, requestData, {
            headers: {
              Authorization: authorization,
              'Content-Type': 'application/json',
            },
          }),
        1000,
        3,
        'exponential',
      )

      if (response.data.rCode !== '0') {
        throw new CustomHttpException(ErrorCode.COUPANG_PARTNERS_API_ERROR, { message: response.data.rMessage })
      }

      const affiliateLink = response.data.data[0]
      return {
        originalUrl: coupangUrl,
        shortenUrl: affiliateLink.shortenUrl,
        landingUrl: affiliateLink.landingUrl,
      }
    } catch (error) {
      if (error instanceof CustomHttpException) throw error
      this.logger.error('어필리에이트 링크 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.COUPANG_PARTNERS_LINK_FAILED)
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
      const authorization = this.generateHmac('POST', `${path}?${query}`, config.secretKey, config.accessKey)

      await this.httpClient.post(
        `${path}?${query}`,
        { coupangUrls: ['https://www.coupang.com/vp/products/test'] },
        {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
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
