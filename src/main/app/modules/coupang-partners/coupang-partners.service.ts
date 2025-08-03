import axios, { AxiosInstance } from 'axios'
import * as crypto from 'crypto'
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

    // UTC 시간을 사용하여 서명 생성 (YYMMDDTHHmmssZ 형식)
    const now = new Date()
    const utcYear = String(now.getUTCFullYear()).slice(-2) // YY 형식
    const utcMonth = String(now.getUTCMonth() + 1).padStart(2, '0')
    const utcDay = String(now.getUTCDate()).padStart(2, '0')
    const utcHour = String(now.getUTCHours()).padStart(2, '0')
    const utcMinute = String(now.getUTCMinutes()).padStart(2, '0')
    const utcSecond = String(now.getUTCSeconds()).padStart(2, '0')

    const datetime = `${utcYear}${utcMonth}${utcDay}T${utcHour}${utcMinute}${utcSecond}Z`

    const message = datetime + method + path + query

    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex')

    return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`
  }

  /**
   * 쿠팡 어필리에이트 링크 생성
   */
  async createAffiliateLink(coupangUrl: string, subId?: string): Promise<CoupangAffiliateLink> {
    const config = await this.getConfig()

    if (!config.accessKey || !config.secretKey) {
      throw new CoupangPartnersErrorClass({
        code: 'MISSING_API_KEYS',
        message: '쿠팡 파트너스 API 키가 설정되지 않았습니다.',
      })
    }

    const endpoint = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink'
    const authorization = this.generateSignature('POST', endpoint, config.secretKey, config.accessKey)

    const requestData: CoupangDeeplinkRequest = {
      coupangUrls: [coupangUrl],
      ...(subId && { subId }),
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
    } catch (error: any) {
      this.logger.error('어필리에이트 링크 생성 실패:', error)

      // 공식 문서의 에러 케이스별 처리
      if (error.response?.data) {
        const errorData = error.response.data

        switch (errorData.code) {
          case 'ERROR':
            switch (errorData.message) {
              case 'Unknown error occurred, please contact api-gateway channel for the details.':
                throw new CoupangPartnersErrorClass({
                  code: 'INVALID_ACCESS_KEY',
                  message: 'Access Key가 잘못 입력되었습니다. API 키를 확인해주세요.',
                  details: errorData,
                })

              case 'Invalid signature.':
                throw new CoupangPartnersErrorClass({
                  code: 'INVALID_SIGNATURE',
                  message: '서명 생성이 잘못되었습니다. API 키와 서명 생성 로직을 확인해주세요.',
                  details: errorData,
                })

              case 'Request is not authorized.':
                throw new CoupangPartnersErrorClass({
                  code: 'UNAUTHORIZED_REQUEST',
                  message: '미인증된 요청입니다. Authorization 헤더가 없거나 잘못된 값을 설정했습니다.',
                  details: errorData,
                })

              case 'Specified signature is expired.':
                throw new CoupangPartnersErrorClass({
                  code: 'SIGNATURE_EXPIRED',
                  message: 'HMAC 서명이 만료되었습니다. 서명을 다시 생성해야 합니다.',
                  details: errorData,
                })

              case 'HMAC format is invalid.':
                throw new CoupangPartnersErrorClass({
                  code: 'INVALID_HMAC_FORMAT',
                  message: 'HMAC 서명의 포맷이 올바르지 않습니다. 서명 생성 방식을 확인해주세요.',
                  details: errorData,
                })

              default:
                throw new CoupangPartnersErrorClass({
                  code: 'API_ERROR',
                  message: `쿠팡 API 오류: ${errorData.message}`,
                  details: errorData,
                })
            }
            break

          default:
            throw new CoupangPartnersErrorClass({
              code: 'UNKNOWN_ERROR',
              message: '알 수 없는 오류가 발생했습니다.',
              details: errorData,
            })
        }
      }

      // 네트워크 오류나 기타 예외 처리
      if (error.code === 'ECONNABORTED') {
        throw new CoupangPartnersErrorClass({
          code: 'TIMEOUT',
          message: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
          details: error,
        })
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new CoupangPartnersErrorClass({
          code: 'NETWORK_ERROR',
          message: '네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
          details: error,
        })
      }

      // 기본 에러 처리
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
