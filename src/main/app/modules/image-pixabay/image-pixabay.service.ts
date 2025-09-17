import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { SettingsService } from '../settings/settings.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class ImagePixabayService {
  private readonly logger = new Logger(ImagePixabayService.name)

  constructor(private readonly settingsService: SettingsService) {}

  public async searchImage(keywords: string[]): Promise<string[]> {
    if (!keywords?.length) {
      throw new CustomHttpException(ErrorCode.INVALID_INPUT, { message: '검색할 키워드가 제공되지 않았습니다.' })
    }

    const pixabayApiKey = await this._getPixabayApiKey()

    // 각 키워드에서 다수의 결과를 수집하고 중복 제거
    const collected: string[] = []
    const seen = new Set<string>()

    for (const keyword of keywords) {
      const results = await this._searchImageUrlsByKeyword(keyword, pixabayApiKey)
      if (results && results.length) {
        this.logger.log(`이미지 검색 성공 - 키워드: ${keyword}, ${results.length}건`)
        for (const url of results) {
          if (!seen.has(url)) {
            seen.add(url)
            collected.push(url)
          }
        }
      }
    }

    if (!collected.length) {
      throw new CustomHttpException(ErrorCode.PIXABAY_IMAGE_NOT_FOUND, {
        message: `모든 키워드에 대해 이미지를 찾을 수 없습니다: ${keywords.join(', ')}`,
      })
    }

    return collected
  }

  private async _getPixabayApiKey(): Promise<string> {
    const settings = await this.settingsService.getSettings()
    const apiKey = settings.pixabayApiKey

    if (!apiKey) {
      throw new CustomHttpException(ErrorCode.PIXABAY_API_KEY_REQUIRED)
    }

    return apiKey
  }

  private async _searchImageUrlsByKeyword(keyword: string, apiKey: string): Promise<string[] | null> {
    try {
      this.logger.log(`키워드로 이미지 검색 시도: ${keyword}`)

      const response = await axios.get('https://pixabay.com/api/', {
        params: {
          key: apiKey,
          q: keyword,
          image_type: 'photo',
          orientation: 'horizontal',
          safesearch: true,
          per_page: 20,
        },
      })

      if (!response.data.hits?.length) {
        this.logger.warn(`키워드에 대한 이미지를 찾을 수 없습니다: ${keyword}`)
        return null
      }

      // largeImageURL 목록 반환
      const urls: string[] = response.data.hits
        .map((hit: any) => hit?.largeImageURL)
        .filter((u: string | undefined) => typeof u === 'string' && u.length > 0)

      return urls.length ? urls : null
    } catch (error) {
      this.logger.warn(`키워드 검색 중 오류 발생: ${keyword}, 오류: ${error.message}`)
      return null
    }
  }
}
