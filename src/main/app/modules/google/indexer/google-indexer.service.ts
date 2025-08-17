import { SiteConfigService } from '@main/app/modules/site-config/site-config.service'
import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import axios from 'axios'
import { firstValueFrom } from 'rxjs'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { GoogleAuthService } from '@main/app/modules/google/auth/google-auth.service'
import { JobLogsService } from '@main/app/modules/job/job-logs/job-logs.service'

export interface GoogleIndexerOptions {
  url?: string
  urls?: string[]
  siteId: number // siteUrl 대신 siteId 사용
  type?: 'URL_UPDATED' | 'URL_DELETED'
}

@Injectable()
export class GoogleIndexerService {
  private readonly logger = new Logger(GoogleIndexerService.name)
  private readonly googleIndexingUrl = 'https://indexing.googleapis.com/v3/urlNotifications:publish'

  constructor(
    private readonly httpService: HttpService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly prisma: PrismaService,
    private readonly siteConfigService: SiteConfigService,
    private readonly jobLogsService: JobLogsService,
  ) {}

  private async getGoogleConfigForSite(siteId: number) {
    try {
      const siteConfig = await this.siteConfigService.getSiteConfig(siteId)

      if (!siteConfig.googleConfig || !siteConfig.googleConfig.use) {
        throw new CustomHttpException(ErrorCode.GOOGLE_CONFIG_DISABLED, { siteId })
      }

      const config = siteConfig.googleConfig

      if (!config.serviceAccountJson) {
        throw new CustomHttpException(ErrorCode.GOOGLE_SERVICE_ACCOUNT_MISSING, { siteId })
      }

      try {
        JSON.parse(config.serviceAccountJson)
      } catch (error) {
        throw new CustomHttpException(ErrorCode.GOOGLE_SERVICE_ACCOUNT_MISSING, { siteId, parseError: error.message })
      }

      return { config, siteConfig }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.GOOGLE_UNKNOWN_ERROR, { siteId, errorMessage: error.message })
    }
  }

  async indexUrl(siteId: number, url: string, type: string = 'URL_UPDATED'): Promise<any> {
    this.logger.log(`Google에 URL 인덱싱 요청: ${url} (Site ID: ${siteId})`)

    try {
      await this.siteConfigService.validateSiteExists(siteId)
      await this.siteConfigService.validateUrlDomain(siteId, url)

      const { config } = await this.getGoogleConfigForSite(siteId)
      const payload = {
        url,
        type,
      }

      let headers
      try {
        headers = await this.googleAuthService.getAuthHeaders(config.serviceAccountJson)
      } catch (error) {
        throw new CustomHttpException(ErrorCode.GOOGLE_AUTH_FAIL, { url, siteId, type, errorMessage: error.message })
      }

      const response = await firstValueFrom(this.httpService.post(this.googleIndexingUrl, payload, { headers }))

      this.logger.log(`Google URL 인덱싱 성공: ${url}`)
      return response.data
    } catch (error) {
      this.logger.error(`Google 색인 요청 실패: ${error.message}`, error.stack)

      if (error instanceof CustomHttpException) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new CustomHttpException(ErrorCode.GOOGLE_AUTH_FAIL, { url, siteId, type, responseStatus: 401 })
      } else if (error.response?.status === 403) {
        // Google API 403 에러의 세부 메시지를 확인하여 구체적인 에러 처리
        const errorData = error.response?.data?.error
        if (errorData?.message?.includes('Failed to verify the URL ownership')) {
          throw new CustomHttpException(ErrorCode.GOOGLE_URL_OWNERSHIP_VERIFICATION_FAILED, {
            url,
            siteId,
            type,
            responseStatus: 403,
            responseData: error.response?.data,
          })
        } else {
          throw new CustomHttpException(ErrorCode.GOOGLE_API_FORBIDDEN, {
            url,
            siteId,
            type,
            responseStatus: 403,
            responseData: error.response?.data,
          })
        }
      } else if (error.response?.status === 429) {
        throw new CustomHttpException(ErrorCode.GOOGLE_API_RATE_LIMIT, {
          url,
          siteId,
          type,
          responseStatus: 429,
          responseData: error.response?.data,
        })
      }

      throw new CustomHttpException(ErrorCode.GOOGLE_UNKNOWN_ERROR, {
        url,
        siteId,
        type,
        errorMessage: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        axiosCode: error.code,
      })
    }
  }

  async getIndexStatus(siteId: number, url: string): Promise<any> {
    this.logger.log(`Google 인덱스 상태 조회: ${url} (Site ID: ${siteId})`)

    try {
      const { config } = await this.getGoogleConfigForSite(siteId)

      let headers
      try {
        headers = await this.googleAuthService.getAuthHeaders(config.serviceAccountJson)
      } catch (error) {
        throw new CustomHttpException(ErrorCode.GOOGLE_AUTH_FAIL, { url, siteId, errorMessage: error.message })
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
          {
            headers,
          },
        ),
      )

      this.logger.log(`Google 인덱스 상태 조회 성공: ${url}`)
      return response.data
    } catch (error) {
      this.logger.error(`Google 인덱스 상태 조회 실패: ${error.message}`, error.stack)

      if (error instanceof CustomHttpException) {
        throw error
      }

      if (error.response?.status === 404) {
        return { status: 'NOT_INDEXED', message: '인덱스되지 않은 URL입니다.' }
      }

      throw new CustomHttpException(ErrorCode.GOOGLE_UNKNOWN_ERROR, {
        url,
        siteId,
        errorMessage: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
      })
    }
  }

  async batchIndexUrls(siteId: number, urls: string[], type: string = 'URL_UPDATED'): Promise<any> {
    this.logger.log(`Google 배치 URL 인덱싱 시작: ${urls.length}개 URL (Site ID: ${siteId})`)

    await this.siteConfigService.validateSiteExists(siteId)

    for (const url of urls) {
      await this.siteConfigService.validateUrlDomain(siteId, url)
    }

    const allResults = []
    const concurrencyLimit = 3
    const delayBetweenRequests = 1000

    for (let i = 0; i < urls.length; i += concurrencyLimit) {
      const chunk = urls.slice(i, i + concurrencyLimit)
      const chunkPromises = chunk.map(url => this.indexUrl(siteId, url, type))

      try {
        const chunkResults = await Promise.allSettled(chunkPromises)
        allResults.push(...chunkResults)

        if (i + concurrencyLimit < urls.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests))
        }
      } catch (error) {
        this.logger.error(`배치 인덱싱 청크 실패 (${i}-${i + chunk.length}):`, error)
      }
    }

    const successResults = []
    const failedResults = []

    allResults.forEach((result, index) => {
      const targetUrl = urls[index]

      if (result.status === 'fulfilled') {
        successResults.push({
          url: targetUrl,
          status: 'success',
          data: result.value,
        })
      } else {
        failedResults.push({
          url: targetUrl,
          status: 'failed',
          error: result.reason?.message || '알 수 없는 오류',
          errorDetails: result.reason,
        })
      }
    })

    const summary = {
      total: urls.length,
      success: successResults.length,
      failed: failedResults.length,
      successUrls: successResults,
      failedUrls: failedResults,
    }

    this.logger.log(
      `Google 배치 URL 인덱싱 완료: 총 ${urls.length}개 중 성공 ${successResults.length}개, 실패 ${failedResults.length}개`,
    )

    if (failedResults.length === 0) {
      return {
        success: true,
        message: `모든 URL(${successResults.length}개)이 성공적으로 색인되었습니다.`,
        data: summary,
      }
    }

    if (successResults.length > 0) {
      return {
        success: true,
        message: `${successResults.length}개 URL 성공, ${failedResults.length}개 URL 실패`,
        data: summary,
      }
    }

    throw new CustomHttpException(ErrorCode.GOOGLE_UNKNOWN_ERROR, { siteId, urls, summary })
  }

  async manualIndexing(options: GoogleIndexerOptions): Promise<any> {
    const { url, urls, siteId, type = 'URL_UPDATED' } = options

    if (!siteId) {
      throw new CustomHttpException(ErrorCode.GOOGLE_SERVICE_ACCOUNT_MISSING, { options })
    }

    if (url) {
      return await this.indexUrl(siteId, url, type)
    }

    if (urls && urls.length > 0) {
      return await this.batchIndexUrls(siteId, urls, type)
    }

    throw new CustomHttpException(ErrorCode.GOOGLE_UNKNOWN_ERROR, { siteId, options })
  }

  // 레거시 호환성을 위한 메서드 (필요한 경우)
  async indexUrls(urls: string[], siteId?: number): Promise<any> {
    if (!siteId) {
      throw new CustomHttpException(ErrorCode.GOOGLE_SERVICE_ACCOUNT_MISSING, { urls })
    }

    return await this.batchIndexUrls(siteId, urls)
  }

  async submitUrl(siteId: number, url: string, jobId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const siteConfig = await this.siteConfigService.getSiteConfig(siteId)
      if (!siteConfig) {
        throw new Error('사이트를 찾을 수 없습니다.')
      }
      const googleConfig = siteConfig.googleConfig
      if (!googleConfig?.serviceAccountJson) {
        throw new Error('Google Service Account JSON이 설정되지 않았습니다.')
      }
      const headers = await this.googleAuthService.getAuthHeaders(googleConfig.serviceAccountJson)
      const response = await axios.post(
        'https://indexing.googleapis.com/v3/urlNotifications:publish',
        {
          url,
          type: 'URL_UPDATED',
        },
        { headers },
      )

      // TODO 성공시 아래처럼 나옴
      // status 200
      //{
      //   "urlNotificationMetadata": {
      //     "url": "https://pyramid-ing.com/"
      //   }
      // }

      if (jobId) {
        await this.jobLogsService.log(jobId, `Google 인덱싱 요청 성공: ${response.data.urlNotificationMetadata.url}`)
      }

      return {
        success: true,
        message: '인덱싱 요청이 성공적으로 처리되었습니다.',
      }
    } catch (error) {
      // {
      //   "error": {
      //   "code": 400,
      //       "message": "Invalid attribute. 'url' is not in standard URL format: pyramid-ing.com/2025/07/07/%ec%b9%b4%ec%b9%b4%ec%98%a4%ed%8e%98%ec%9d%b4-atm-%ec%b6%9c%ea%b8%88-%eb%b0%a9%eb%b2%95-%ec%b9%b4%eb%93%9c%ec%97%86%ec%9d%b4-%ec%8a%a4%eb%a7%88%ed%8a%b8%ed%8f%b0-%ec%9d%b8%ec%b6%9c",
      //       "status": "INVALID_ARGUMENT"
      // }
      // }
      if (jobId) {
        await this.jobLogsService.log(jobId, `Google 인덱싱 요청 실패: ${error.message}`)
      }

      // Google API 에러 메시지에 따른 구체적인 에러 처리
      let errorMessage = error.message

      if (error.response?.status === 403) {
        const errorData = error.response?.data?.error
        if (errorData?.message?.includes('Failed to verify the URL ownership')) {
          errorMessage = 'URL 소유권 확인에 실패했습니다. Google Search Console에서 사이트 소유권을 확인해주세요.'
        } else {
          errorMessage = 'Google Indexing API 권한이 없습니다. 서비스 계정 권한을 확인해주세요.'
        }
      } else if (error.response?.status === 401) {
        errorMessage = 'Google API 인증이 실패했습니다. 서비스 계정 JSON을 확인해주세요.'
      } else if (error.response?.status === 429) {
        errorMessage = 'Google API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
      }

      return {
        success: false,
        message: `인덱싱 요청 실패: ${errorMessage}`,
      }
    }
  }
}
