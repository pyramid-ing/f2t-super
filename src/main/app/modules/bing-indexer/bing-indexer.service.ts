import { SiteConfigService } from '@main/app/modules/site-config/site-config.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'
import { BingSubmitPayload } from 'src/main/app/modules/bing-indexer/bing-indexer.types'

@Injectable()
export class BingIndexerService {
  private readonly bingApiUrl = 'https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch'
  private readonly logger = new Logger(BingIndexerService.name)

  constructor(
    private readonly httpService: HttpService,
    private readonly siteConfigService: SiteConfigService,
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

  async submitUrls(
    siteId: number,
    urls: string[],
  ): Promise<{ success: boolean; message: string; results: { url: string; success: boolean; message?: string }[] }> {
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
        // 전체 실패로 간주하여 결과 매핑
        return {
          success: false,
          message: response.data.d.Message || 'Bing API 에러',
          results: urls.map(url => ({ url, success: false, message: response.data.d.Message })),
        }
      }

      // 성공으로 간주: URL별 성공 결과 구성
      return {
        success: true,
        message: 'Bing 벌크 인덱싱 요청 성공',
        results: urls.map(url => ({ url, success: true, message: 'OK' })),
      }
    } catch (error) {
      // 개별 실패 로그/상태 업데이트는 호출부에서 처리

      if (error instanceof CustomHttpException) {
        throw error
      }

      // 에러를 결과 배열로 매핑하여 반환 (부분 실패 정보가 없으므로 전체 실패 처리)
      const message =
        (error.response?.data && (error.response.data.message || error.response.data.ErrorMessage)) || error.message
      return {
        success: false,
        message: message || 'Bing 벌크 인덱싱 실패',
        results: urls.map(url => ({ url, success: false, message })),
      }
    }
  }
}
