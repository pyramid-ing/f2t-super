import { Injectable, Logger } from '@nestjs/common'
import { WordPressAccount, WordPressPost } from './wordpress.types'
import axios from 'axios'
import FormData from 'form-data'
import * as fs from 'fs'
import * as path from 'path'

// WordPressApiError 클래스 정의
export class WordPressApiErrorClass extends Error {
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
   * Basic Authentication 헤더 생성 (Application Passwords 사용)
   */
  private getBasicAuthHeaders(account: WordPressAccount, additionalHeaders?: Record<string, string>) {
    // 워드프레스 사용자명과 Application Password 사용
    const credentials = `${account.wpUsername}:${account.apiKey}`

    const base64Credentials = Buffer.from(credentials).toString('base64')

    return {
      'Content-Type': 'application/json',
      Authorization: `Basic ${base64Credentials}`,
      ...additionalHeaders,
    }
  }

  /**
   * 워드프레스 API 에러 메시지 추출
   */
  private extractWordPressErrorMessage(error: any): string {
    if (error.response?.data) {
      const errorData = error.response.data

      // 워드프레스 REST API 에러 형식
      if (errorData.message) {
        return errorData.message
      }

      // 일반적인 HTTP 에러
      if (errorData.error) {
        return errorData.error
      }

      // 기타 에러 메시지
      if (typeof errorData === 'string') {
        return errorData
      }
    }

    // 기본 에러 메시지
    return error.message || '알 수 없는 오류가 발생했습니다.'
  }

  /**
   * 워드프레스 포스트 발행
   */
  async publishPost(account: WordPressAccount, postData: WordPressPost): Promise<{ postId: number; url: string }> {
    try {
      // WordPress REST API를 사용하여 포스트 발행
      const response = await axios.post(
        `${account.url}/wp-json/wp/v2/posts`,
        {
          title: postData.title,
          content: postData.content,
          status: postData.status,
          featured_media: postData.featuredMediaId,
          categories: postData.categories,
          tags: postData.tags,
        },
        {
          headers: this.getBasicAuthHeaders(account),
        },
      )

      const post = response.data

      // URL 인코딩 문제 해결
      let processedUrl = post.link
      try {
        // URL 객체를 사용하여 안전하게 처리
        const url = new URL(post.link)

        // pathname 부분만 디코딩/인코딩 처리
        const decodedPathname = decodeURIComponent(url.pathname)
        url.pathname = decodedPathname

        processedUrl = url.toString()
      } catch (error) {
        this.logger.warn('URL 인코딩 처리 실패, 원본 URL 사용:', error)
        processedUrl = post.link
      }

      return {
        postId: post.id,
        url: processedUrl,
      }
    } catch (error) {
      this.logger.error('워드프레스 포스트 발행 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'POST_PUBLISH_FAILED',
        message: `워드프레스 포스트 발행에 실패했습니다: ${errorMessage}`,
        details: error.response.data,
      })
    }
  }

  /**
   * 워드프레스에 이미지 업로드
   */
  async uploadImage(account: WordPressAccount, imagePath: string): Promise<string> {
    try {
      // 파일 정보 가져오기
      const fileName = path.basename(imagePath)
      const fileExtension = path.extname(imagePath).toLowerCase()

      // MIME 타입 결정
      let mimeType = 'image/jpeg'
      switch (fileExtension) {
        case '.png':
          mimeType = 'image/png'
          break
        case '.gif':
          mimeType = 'image/gif'
          break
        case '.webp':
          mimeType = 'image/webp'
          break
        case '.svg':
          mimeType = 'image/svg+xml'
          break
        default:
          mimeType = 'image/jpeg'
      }

      // 파일을 FormData로 준비
      const formData = new FormData()
      const fileStream = fs.createReadStream(imagePath)

      formData.append('file', fileStream, {
        filename: fileName,
        contentType: mimeType,
      })

      // Basic Authentication 헤더 설정
      const headers = {
        ...this.getBasicAuthHeaders(account),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': mimeType,
        ...formData.getHeaders(),
      }

      const response = await axios.post(`${account.url}/wp-json/wp/v2/media`, formData, {
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })

      const media = response.data
      return media.source_url
    } catch (error) {
      this.logger.error('워드프레스 이미지 업로드 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'IMAGE_UPLOAD_FAILED',
        message: `워드프레스 이미지 업로드에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 사이트 정보 조회
   */
  async getSiteInfo(account: WordPressAccount): Promise<any> {
    try {
      const response = await axios.get(`${account.url}/wp-json`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 사이트 정보 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'SITE_INFO_FETCH_FAILED',
        message: `워드프레스 사이트 정보 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 카테고리 목록 조회
   */
  async getCategories(account: WordPressAccount, search?: string): Promise<any[]> {
    try {
      const params: any = {
        per_page: 100, // 기본값 10에서 100으로 증가
        orderby: 'name',
        order: 'asc',
      }

      // 검색어가 있으면 search 파라미터 추가
      if (search) {
        params.search = search
      }

      const response = await axios.get(`${account.url}/wp-json/wp/v2/categories`, {
        headers: this.getBasicAuthHeaders(account),
        params,
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 카테고리 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'CATEGORIES_FETCH_FAILED',
        message: `워드프레스 카테고리 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 태그 목록 조회
   */
  async getTags(account: WordPressAccount, search?: string): Promise<any[]> {
    try {
      const params: any = {
        per_page: 100, // 기본값 10에서 100으로 증가
        orderby: 'name',
        order: 'asc',
      }

      // 검색어가 있으면 search 파라미터 추가
      if (search) {
        params.search = search
      }

      const response = await axios.get(`${account.url}/wp-json/wp/v2/tags`, {
        headers: this.getBasicAuthHeaders(account),
        params,
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 태그 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'TAGS_FETCH_FAILED',
        message: `워드프레스 태그 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 태그 생성 또는 조회 (getOrCreate)
   */
  async getOrCreateTag(account: WordPressAccount, tagName: string): Promise<number> {
    try {
      // 먼저 기존 태그가 있는지 검색으로 확인 (더 효율적)
      const existingTags = await this.getTags(account, tagName)
      const existingTag = existingTags.find(tag => tag.name.toLowerCase() === tagName.toLowerCase())

      if (existingTag) {
        return existingTag.id
      }

      // 태그가 없으면 새로 생성
      const response = await axios.post(
        `${account.url}/wp-json/wp/v2/tags`,
        {
          name: tagName,
          slug: tagName.toLowerCase().replace(/\s+/g, '-'),
        },
        {
          headers: this.getBasicAuthHeaders(account),
        },
      )

      return response.data.id
    } catch (error) {
      this.logger.error('워드프레스 태그 생성 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'TAG_CREATE_FAILED',
        message: `워드프레스 태그 생성에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 카테고리 생성 또는 조회 (getOrCreate)
   */
  async getOrCreateCategory(account: WordPressAccount, categoryName: string): Promise<number> {
    try {
      // 먼저 기존 카테고리가 있는지 검색으로 확인 (더 효율적)
      const existingCategories = await this.getCategories(account, categoryName)
      const existingCategory = existingCategories.find(
        category => category.name.toLowerCase() === categoryName.toLowerCase(),
      )

      if (existingCategory) {
        return existingCategory.id
      }

      // 카테고리가 없으면 새로 생성
      const response = await axios.post(
        `${account.url}/wp-json/wp/v2/categories`,
        {
          name: categoryName,
          slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
        },
        {
          headers: this.getBasicAuthHeaders(account),
        },
      )

      return response.data.id
    } catch (error) {
      this.logger.error('워드프레스 카테고리 생성 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'CATEGORY_CREATE_FAILED',
        message: `워드프레스 카테고리 생성에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 미디어 ID로 URL 조회
   */
  async getMediaUrl(account: WordPressAccount, mediaId: number): Promise<string> {
    try {
      const response = await axios.get(`${account.url}/wp-json/wp/v2/media/${mediaId}`, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data.source_url
    } catch (error) {
      this.logger.error('워드프레스 미디어 URL 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'MEDIA_URL_FETCH_FAILED',
        message: `워드프레스 미디어 URL 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 URL을 기반으로 미디어 ID 추출
   */
  async getMediaIdByUrl(account: WordPressAccount, mediaUrl: string): Promise<number | null> {
    try {
      // 미디어 목록을 조회하여 URL과 일치하는 미디어 찾기
      const response = await axios.get(`${account.url}/wp-json/wp/v2/media`, {
        headers: this.getBasicAuthHeaders(account),
        params: {
          per_page: 100, // 한 번에 조회할 미디어 수
        },
      })

      const mediaItems = response.data

      // URL과 일치하는 미디어 찾기
      const matchingMedia = mediaItems.find((media: any) => {
        // source_url, guid.rendered, 또는 기타 URL 필드들과 비교
        return media.source_url === mediaUrl || media.guid?.rendered === mediaUrl || media.url === mediaUrl
      })

      if (matchingMedia) {
        return matchingMedia.id
      }

      // 정확히 일치하지 않으면 URL 경로 기반으로 검색
      const urlPath = new URL(mediaUrl).pathname
      const pathMatchingMedia = mediaItems.find((media: any) => {
        const mediaUrlPath = new URL(media.source_url).pathname
        return mediaUrlPath === urlPath
      })

      return pathMatchingMedia ? pathMatchingMedia.id : null
    } catch (error) {
      this.logger.error('워드프레스 미디어 ID 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'MEDIA_ID_FETCH_FAILED',
        message: `워드프레스 미디어 ID 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }
}
