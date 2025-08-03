import { Injectable, Logger } from '@nestjs/common'
import { WordPressAccount, WordPressPost } from './wordpress.types'

// WordPressApiError 클래스 정의
class WordPressApiErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'WordPressApiError'
  }
}

@Injectable()
export class WordPressApiService {
  private readonly logger = new Logger(WordPressApiService.name)

  /**
   * 워드프레스 포스트 발행
   */
  async publishPost(account: WordPressAccount, postData: WordPressPost): Promise<{ postId: number; url: string }> {
    try {
      // WordPress REST API를 사용하여 포스트 발행
      const response = await fetch(`${account.url}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${account.apiKey}`,
        },
        body: JSON.stringify({
          title: postData.title,
          content: postData.content,
          status: 'publish',
          categories: postData.categories,
          tags: postData.tags,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`워드프레스 API 오류: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      const post = await response.json()

      return {
        postId: post.id,
        url: post.link,
      }
    } catch (error) {
      this.logger.error('워드프레스 포스트 발행 실패:', error)
      throw new WordPressApiErrorClass({
        code: 'POST_PUBLISH_FAILED',
        message: '워드프레스 포스트 발행에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스에 이미지 업로드
   */
  async uploadImage(account: WordPressAccount, imagePath: string, fileName: string): Promise<string> {
    try {
      // 파일을 FormData로 준비
      const fs = await import('fs')
      const { default: FormData } = await import('form-data')

      const formData = new FormData()
      formData.append('file', fs.createReadStream(imagePath), {
        filename: fileName,
        contentType: 'image/webp',
      })

      const response = await fetch(`${account.url}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${account.apiKey}`,
          ...formData.getHeaders(),
        },
        body: formData.getBuffer(),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`워드프레스 이미지 업로드 오류: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      const media = await response.json()
      return media.source_url
    } catch (error) {
      this.logger.error('워드프레스 이미지 업로드 실패:', error)
      throw new WordPressApiErrorClass({
        code: 'IMAGE_UPLOAD_FAILED',
        message: '워드프레스 이미지 업로드에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스 사이트 정보 조회
   */
  async getSiteInfo(account: WordPressAccount): Promise<any> {
    try {
      const response = await fetch(`${account.url}/wp-json`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`워드프레스 사이트 정보 조회 오류: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      this.logger.error('워드프레스 사이트 정보 조회 실패:', error)
      throw new WordPressApiErrorClass({
        code: 'SITE_INFO_FETCH_FAILED',
        message: '워드프레스 사이트 정보 조회에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스 카테고리 목록 조회
   */
  async getCategories(account: WordPressAccount): Promise<any[]> {
    try {
      const response = await fetch(`${account.url}/wp-json/wp/v2/categories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${account.apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(`워드프레스 카테고리 조회 오류: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      this.logger.error('워드프레스 카테고리 조회 실패:', error)
      throw new WordPressApiErrorClass({
        code: 'CATEGORIES_FETCH_FAILED',
        message: '워드프레스 카테고리 조회에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스 태그 목록 조회
   */
  async getTags(account: WordPressAccount): Promise<any[]> {
    try {
      const response = await fetch(`${account.url}/wp-json/wp/v2/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${account.apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(`워드프레스 태그 조회 오류: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      this.logger.error('워드프레스 태그 조회 실패:', error)
      throw new WordPressApiErrorClass({
        code: 'TAGS_FETCH_FAILED',
        message: '워드프레스 태그 조회에 실패했습니다.',
        details: error,
      })
    }
  }
}
