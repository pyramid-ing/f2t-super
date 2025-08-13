import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { SettingsService } from '../settings/settings.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class ImagePixabayService {
  private readonly logger = new Logger(ImagePixabayService.name)

  constructor(private readonly settingsService: SettingsService) {}

  private async getPixabayApiKey(): Promise<string> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.pixabayApiKey

    if (!apiKey) {
      throw new CustomHttpException(ErrorCode.PIXABAY_API_KEY_REQUIRED)
    }

    return apiKey
  }

  private async searchSingleKeyword(keyword: string, apiKey: string): Promise<string | null> {
    try {
      this.logger.log(`키워드로 이미지 검색 시도: ${keyword}`)

      const response = await axios.get('https://pixabay.com/api/', {
        params: {
          key: apiKey,
          q: keyword,
          image_type: 'photo',
          orientation: 'horizontal',
          safesearch: true,
          per_page: 3,
        },
      })

      if (!response.data.hits?.length) {
        this.logger.warn(`키워드에 대한 이미지를 찾을 수 없습니다: ${keyword}`)
        return null
      }

      return response.data.hits[0].largeImageURL
    } catch (error) {
      this.logger.warn(`키워드 검색 중 오류 발생: ${keyword}, 오류: ${error.message}`)
      return null
    }
  }

  async searchImage(keywords: string[]): Promise<string> {
    if (!keywords?.length) {
      throw new CustomHttpException(ErrorCode.INVALID_INPUT, { message: '검색할 키워드가 제공되지 않았습니다.' })
    }

    const pixabayApiKey = await this.getPixabayApiKey()

    // 각 키워드를 순차적으로 시도
    for (const keyword of keywords) {
      const result = await this.searchSingleKeyword(keyword, pixabayApiKey)
      if (result) {
        this.logger.log(`이미지 검색 성공 - 키워드: ${keyword}`)
        return result
      }
    }

    // 모든 키워드가 실패한 경우
    throw new CustomHttpException(ErrorCode.PIXABAY_IMAGE_NOT_FOUND, {
      message: `모든 키워드에 대해 이미지를 찾을 수 없습니다: ${keywords.join(', ')}`,
    })
  }
}
