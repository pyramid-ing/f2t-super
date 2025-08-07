import { Injectable, Logger } from '@nestjs/common'
import { WordPressAccount, WordPressPostRequest } from './wordpress.types'
import {
  WordPressTag,
  WordPressCategory,
  WordPressMedia,
  WordPressPost,
  WordPressTagListParams,
  WordPressCategoryListParams,
  WordPressMediaListParams,
  WordPressPostListParams,
  CreateWordPressTagRequest,
  CreateWordPressCategoryRequest,
  UpdateWordPressTagRequest,
  UpdateWordPressCategoryRequest,
  CreateWordPressPostRequest,
  UpdateWordPressPostRequest,
} from './wordpress.types'
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
  async publishPost(
    account: WordPressAccount,
    postData: WordPressPostRequest,
  ): Promise<{ postId: number; url: string }> {
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
  async getCategories(account: WordPressAccount, params?: WordPressCategoryListParams): Promise<WordPressCategory[]> {
    try {
      const queryParams = {
        context: 'view',
        page: 1,
        per_page: 100,
        orderby: 'name',
        order: 'asc',
        ...params,
      }

      const response = await axios.get(`${account.url}/wp-json/wp/v2/categories`, {
        headers: this.getBasicAuthHeaders(account),
        params: queryParams,
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
  async getTags(account: WordPressAccount, params?: WordPressTagListParams): Promise<WordPressTag[]> {
    try {
      const queryParams: WordPressTagListParams = {
        context: 'view',
        page: 1,
        per_page: 100,
        orderby: 'name',
        order: 'asc',
        ...params,
      }

      const response = await axios.get(`${account.url}/wp-json/wp/v2/tags`, {
        headers: this.getBasicAuthHeaders(account),
        params: queryParams,
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
      const existingTags = await this.getTags(account, { search: tagName })
      const existingTag = existingTags.find(tag => tag.name.toLowerCase() === tagName.toLowerCase())

      if (existingTag) {
        return existingTag.id
      }

      // 태그가 없으면 새로 생성
      const createRequest: CreateWordPressTagRequest = {
        name: tagName,
        slug: tagName.toLowerCase().replace(/\s+/g, '-'),
      }

      const response = await axios.post(`${account.url}/wp-json/wp/v2/tags`, createRequest, {
        headers: this.getBasicAuthHeaders(account),
      })

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
   * 워드프레스 태그 조회 (단일)
   */
  async getTag(account: WordPressAccount, tagId: number): Promise<WordPressTag> {
    try {
      const response = await axios.get(`${account.url}/wp-json/wp/v2/tags/${tagId}`, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 태그 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'TAG_FETCH_FAILED',
        message: `워드프레스 태그 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 태그 업데이트
   */
  async updateTag(
    account: WordPressAccount,
    tagId: number,
    updateData: UpdateWordPressTagRequest,
  ): Promise<WordPressTag> {
    try {
      const response = await axios.post(`${account.url}/wp-json/wp/v2/tags/${tagId}`, updateData, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 태그 업데이트 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'TAG_UPDATE_FAILED',
        message: `워드프레스 태그 업데이트에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 태그 삭제
   */
  async deleteTag(account: WordPressAccount, tagId: number): Promise<void> {
    try {
      await axios.delete(`${account.url}/wp-json/wp/v2/tags/${tagId}`, {
        headers: this.getBasicAuthHeaders(account),
        params: { force: true },
      })
    } catch (error) {
      this.logger.error('워드프레스 태그 삭제 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'TAG_DELETE_FAILED',
        message: `워드프레스 태그 삭제에 실패했습니다: ${errorMessage}`,
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
      const existingCategories = await this.getCategories(account, { search: categoryName })
      const existingCategory = existingCategories.find(
        category => category.name.toLowerCase() === categoryName.toLowerCase(),
      )

      if (existingCategory) {
        return existingCategory.id
      }

      // 카테고리가 없으면 새로 생성
      const createRequest: CreateWordPressCategoryRequest = {
        name: categoryName,
        slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
      }

      const response = await axios.post(`${account.url}/wp-json/wp/v2/categories`, createRequest, {
        headers: this.getBasicAuthHeaders(account),
      })

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
   * 워드프레스 카테고리 조회 (단일)
   */
  async getCategory(account: WordPressAccount, categoryId: number): Promise<WordPressCategory> {
    try {
      const response = await axios.get(`${account.url}/wp-json/wp/v2/categories/${categoryId}`, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 카테고리 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'CATEGORY_FETCH_FAILED',
        message: `워드프레스 카테고리 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 카테고리 업데이트
   */
  async updateCategory(
    account: WordPressAccount,
    categoryId: number,
    updateData: UpdateWordPressCategoryRequest,
  ): Promise<WordPressCategory> {
    try {
      const response = await axios.post(`${account.url}/wp-json/wp/v2/categories/${categoryId}`, updateData, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 카테고리 업데이트 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'CATEGORY_UPDATE_FAILED',
        message: `워드프레스 카테고리 업데이트에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 카테고리 삭제
   */
  async deleteCategory(account: WordPressAccount, categoryId: number): Promise<void> {
    try {
      await axios.delete(`${account.url}/wp-json/wp/v2/categories/${categoryId}`, {
        headers: this.getBasicAuthHeaders(account),
        params: { force: true },
      })
    } catch (error) {
      this.logger.error('워드프레스 카테고리 삭제 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'CATEGORY_DELETE_FAILED',
        message: `워드프레스 카테고리 삭제에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 미디어 목록 조회
   */
  async getMedia(account: WordPressAccount, params?: WordPressMediaListParams): Promise<WordPressMedia[]> {
    try {
      const queryParams = {
        context: 'view',
        page: 1,
        per_page: 100,
        orderby: 'date',
        order: 'desc',
        status: 'inherit',
        ...params,
      }

      const response = await axios.get(`${account.url}/wp-json/wp/v2/media`, {
        headers: this.getBasicAuthHeaders(account),
        params: queryParams,
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 미디어 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'MEDIA_FETCH_FAILED',
        message: `워드프레스 미디어 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 미디어 조회 (단일)
   */
  async getMediaItem(account: WordPressAccount, mediaId: number): Promise<WordPressMedia> {
    try {
      const response = await axios.get(`${account.url}/wp-json/wp/v2/media/${mediaId}`, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 미디어 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'MEDIA_FETCH_FAILED',
        message: `워드프레스 미디어 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 미디어 업데이트
   */
  async updateMedia(
    account: WordPressAccount,
    mediaId: number,
    updateData: {
      title?: { rendered: string }
      caption?: { rendered: string }
      description?: { rendered: string }
      alt_text?: string
      post?: number
    },
  ): Promise<WordPressMedia> {
    try {
      const response = await axios.post(`${account.url}/wp-json/wp/v2/media/${mediaId}`, updateData, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 미디어 업데이트 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'MEDIA_UPDATE_FAILED',
        message: `워드프레스 미디어 업데이트에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 미디어 삭제
   */
  async deleteMedia(account: WordPressAccount, mediaId: number): Promise<void> {
    try {
      await axios.delete(`${account.url}/wp-json/wp/v2/media/${mediaId}`, {
        headers: this.getBasicAuthHeaders(account),
        params: { force: true },
      })
    } catch (error) {
      this.logger.error('워드프레스 미디어 삭제 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'MEDIA_DELETE_FAILED',
        message: `워드프레스 미디어 삭제에 실패했습니다: ${errorMessage}`,
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
      const mediaItems = await this.getMedia(account, { per_page: 100 })

      // URL과 일치하는 미디어 찾기
      const matchingMedia = mediaItems.find((media: WordPressMedia) => {
        // source_url, guid.rendered, 또는 기타 URL 필드들과 비교
        return media.source_url === mediaUrl || media.guid?.rendered === mediaUrl || media.link === mediaUrl
      })

      if (matchingMedia) {
        return matchingMedia.id
      }

      // 정확히 일치하지 않으면 URL 경로 기반으로 검색
      const urlPath = new URL(mediaUrl).pathname
      const pathMatchingMedia = mediaItems.find((media: WordPressMedia) => {
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

  /**
   * 워드프레스 포스트 목록 조회
   */
  async getPosts(account: WordPressAccount, params?: WordPressPostListParams): Promise<WordPressPost[]> {
    try {
      const queryParams: WordPressPostListParams = {
        context: 'view',
        page: 1,
        per_page: 100,
        orderby: 'date',
        order: 'desc',
        status: ['publish'],
        ...params,
      }

      const response = await axios.get(`${account.url}/wp-json/wp/v2/posts`, {
        headers: this.getBasicAuthHeaders(account),
        params: queryParams,
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 포스트 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'POSTS_FETCH_FAILED',
        message: `워드프레스 포스트 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 포스트 조회 (단일)
   */
  async getPost(account: WordPressAccount, postId: number): Promise<WordPressPost> {
    try {
      const response = await axios.get(`${account.url}/wp-json/wp/v2/posts/${postId}`, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 포스트 조회 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'POST_FETCH_FAILED',
        message: `워드프레스 포스트 조회에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 포스트 생성
   */
  async createPost(account: WordPressAccount, postData: CreateWordPressPostRequest): Promise<WordPressPost> {
    try {
      const response = await axios.post(`${account.url}/wp-json/wp/v2/posts`, postData, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 포스트 생성 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'POST_CREATE_FAILED',
        message: `워드프레스 포스트 생성에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 포스트 업데이트
   */
  async updatePost(
    account: WordPressAccount,
    postId: number,
    updateData: UpdateWordPressPostRequest,
  ): Promise<WordPressPost> {
    try {
      const response = await axios.post(`${account.url}/wp-json/wp/v2/posts/${postId}`, updateData, {
        headers: this.getBasicAuthHeaders(account),
      })

      return response.data
    } catch (error) {
      this.logger.error('워드프레스 포스트 업데이트 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'POST_UPDATE_FAILED',
        message: `워드프레스 포스트 업데이트에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 포스트 삭제
   */
  async deletePost(account: WordPressAccount, postId: number): Promise<void> {
    try {
      await axios.delete(`${account.url}/wp-json/wp/v2/posts/${postId}`, {
        headers: this.getBasicAuthHeaders(account),
        params: { force: true },
      })
    } catch (error) {
      this.logger.error('워드프레스 포스트 삭제 실패:', error)
      const errorMessage = this.extractWordPressErrorMessage(error)
      throw new WordPressApiErrorClass({
        code: 'POST_DELETE_FAILED',
        message: `워드프레스 포스트 삭제에 실패했습니다: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * 워드프레스 미디어 ID로 URL 조회
   */
  async getMediaUrl(account: WordPressAccount, mediaId: number): Promise<string> {
    try {
      const media = await this.getMediaItem(account, mediaId)
      return media.source_url
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
}
