import { SiteConfigService } from '@main/app/modules/site-config/site-config.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'
import { BingIndexerOptions, BingSubmitPayload } from 'src/main/app/modules/bing-indexer/bing-indexer.types'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import axios from 'axios'
import { JobLogsService } from '@main/app/modules/job/job-logs/job-logs.service'

@Injectable()
export class BingIndexerService {
  private readonly bingApiUrl = 'https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch'
  private readonly logger = new Logger(BingIndexerService.name)

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly siteConfigService: SiteConfigService,
    private readonly jobLogsService: JobLogsService,
  ) {}

  private async getBingConfigForSite(siteId: number) {
    try {
      const siteConfig = await this.siteConfigService.getSiteConfig(siteId)

      if (!siteConfig.bingConfig || !siteConfig.bingConfig.use) {
        throw new CustomHttpException(ErrorCode.BING_CONFIG_DISABLED, { siteId })
      }

      if (!siteConfig.bingConfig.apiKey) {
        throw new CustomHttpException(ErrorCode.BING_API_KEY_MISSING, { siteId })
      }

      return {
        apiKey: siteConfig.bingConfig.apiKey,
        siteConfig,
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.BING_UNKNOWN_ERROR, { siteId, errorMessage: error.message })
    }
  }

  private createPayload(siteUrl: string, urls: string[]): BingSubmitPayload {
    return {
      siteUrl,
      urlList: urls,
    }
  }

  async submitUrlToBing(siteId: number, url: string): Promise<any> {
    try {
      await this.siteConfigService.validateSiteExists(siteId)
      await this.siteConfigService.validateUrlDomain(siteId, url)

      const { apiKey, siteConfig } = await this.getBingConfigForSite(siteId)
      const payload = this.createPayload(siteConfig.siteUrl, [url])

      const response = await firstValueFrom(
        this.httpService.post(`${this.bingApiUrl}?apikey=${apiKey}`, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )

      // 로그는 호출부에서 처리

      if (response.data && response.data.d && response.data.d.ErrorCode) {
        throw new CustomHttpException(ErrorCode.BING_API_ERROR, {
          url,
          siteId,
          errorCode: response.data.d.ErrorCode,
          errorMessage: response.data.d.Message,
          responseData: response.data,
        })
      }

      await this.jobLogsService.log(job.jobId, `Bing 인덱싱 성공: ${url}`)

      return response.data
    } catch (error) {
      // 실패 로그는 호출부에서 처리

      if (error instanceof CustomHttpException) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new CustomHttpException(ErrorCode.BING_API_AUTH_FAIL, { url, siteId, responseStatus: 401 })
      } else if (error.response?.status === 403) {
        throw new CustomHttpException(ErrorCode.BING_API_FORBIDDEN, {
          url,
          siteId,
          responseStatus: 403,
          responseData: error.response?.data,
        })
      } else if (error.response?.status === 429) {
        throw new CustomHttpException(ErrorCode.BING_API_RATE_LIMIT, {
          url,
          siteId,
          responseStatus: 429,
          responseData: error.response?.data,
        })
      }

      if (error.response?.status === 400 && error.response?.data?.ErrorCode === 3) {
        throw new CustomHttpException(ErrorCode.BING_API_INVALID_KEY, { url, siteId })
      }

      throw new CustomHttpException(ErrorCode.BING_UNKNOWN_ERROR, {
        url,
        siteId,
        errorMessage: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        axiosCode: error.code,
      })
    }
  }

  async submitMultipleUrlsToBing(siteId: number, urls: string[]): Promise<any> {
    try {
      await this.siteConfigService.validateSiteExists(siteId)
      for (const url of urls) {
        await this.siteConfigService.validateUrlDomain(siteId, url)
      }

      const { apiKey, siteConfig } = await this.getBingConfigForSite(siteId)
      const payload = this.createPayload(siteConfig.siteUrl, urls)

      const response = await firstValueFrom(
        this.httpService.post(`${this.bingApiUrl}?apikey=${apiKey}`, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )

      if (response.data && response.data.d && response.data.d.ErrorCode) {
        throw new CustomHttpException(ErrorCode.BING_API_ERROR, {
          siteId,
          urlCount: urls.length,
          errorCode: response.data.d.ErrorCode,
          errorMessage: response.data.d.Message,
          responseData: response.data,
        })
      }

      // 개별 로그/상태 업데이트는 호출부에서 처리

      return response.data
    } catch (error) {
      // 개별 실패 로그/상태 업데이트는 호출부에서 처리

      if (error instanceof CustomHttpException) {
        throw error
      }

      if (error.response?.status === 401) {
        throw new CustomHttpException(ErrorCode.BING_API_AUTH_FAIL, { siteId, urls, responseStatus: 401 })
      } else if (error.response?.status === 403) {
        throw new CustomHttpException(ErrorCode.BING_API_FORBIDDEN, {
          siteId,
          urls,
          responseStatus: 403,
          responseData: error.response?.data,
          urlCount: urls.length,
        })
      } else if (error.response?.status === 429) {
        throw new CustomHttpException(ErrorCode.BING_API_RATE_LIMIT, {
          siteId,
          urls,
          responseStatus: 429,
          responseData: error.response?.data,
          urlCount: urls.length,
        })
      }

      if (error.response?.status === 400 && error.response?.data?.ErrorCode === 3) {
        throw new CustomHttpException(ErrorCode.BING_API_INVALID_KEY, { siteId, urls })
      }

      throw new CustomHttpException(ErrorCode.BING_UNKNOWN_ERROR, {
        siteId,
        urls,
        errorMessage: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        urlCount: urls.length,
        axiosCode: error.code,
      })
    }
  }

  async manualIndexing(options: BingIndexerOptions): Promise<any> {
    const { url, urls, siteId } = options

    if (!siteId) {
      throw new CustomHttpException(ErrorCode.BING_API_KEY_MISSING, { options })
    }

    if (url) {
      return await this.submitUrlToBing(siteId, url)
    }

    if (urls && urls.length > 0) {
      return await this.submitMultipleUrlsToBing(siteId, urls)
    }

    throw new CustomHttpException(ErrorCode.BING_UNKNOWN_ERROR, { siteId, options })
  }

  // 레거시 호환성을 위한 메서드 (필요한 경우)
  async indexUrls(urls: string[], siteId?: number): Promise<any> {
    if (!siteId) {
      throw new CustomHttpException(ErrorCode.BING_API_KEY_MISSING, { urls })
    }

    return await this.submitMultipleUrlsToBing(siteId, urls)
  }

  async submitUrl(siteId: number, url: string, jobId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const siteConfig = await this.siteConfigService.getSiteConfig(siteId)
      if (!siteConfig) {
        throw new Error('사이트를 찾을 수 없습니다.')
      }
      const bingConfig = siteConfig.bingConfig
      if (!bingConfig?.apiKey) {
        throw new Error('Bing API Key가 설정되지 않았습니다.')
      }
      const response = await axios.post(
        `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey=${encodeURIComponent(bingConfig.apiKey)}`,
        {
          siteUrl: siteConfig.siteUrl,
          url,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      // TODO 성공코드 확인후 처리 필요

      // 성공 로그
      if (jobId) {
        await this.jobLogsService.log(jobId, `Bing 인덱싱 요청 성공: ${url}`)
      }

      return {
        success: true,
        message: '인덱싱 요청이 성공적으로 처리되었습니다.',
      }
    } catch (error) {
      // Bing API의 InvalidApiKey 에러 메시지 추출
      if (error.response?.status === 400 && error.response?.data?.ErrorCode === 3) {
        error.message = 'Bing API Key가 유효하지 않습니다. (InvalidApiKey)'
      }

      // 실패 로그
      if (jobId) {
        await this.jobLogsService.log(jobId, `Bing 인덱싱 요청 실패: ${error.message}`, 'error')
      }

      return {
        success: false,
        message: `인덱싱 요청 실패: ${error.message}`,
      }
    }
  }
}
