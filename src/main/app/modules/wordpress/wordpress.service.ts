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
  CreateWordPressPostRequest,
  UpdateWordPressPostRequest,
} from './wordpress.types'
import { WordPressAccountService } from './wordpress-account.service'
import { WordPressApiService } from './wordpress-api.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { assertPermission } from '@main/app/utils/permission.assert'

@Injectable()
export class WordPressService {
  private readonly logger = new Logger(WordPressService.name)

  constructor(
    private readonly accountService: WordPressAccountService,
    private readonly apiService: WordPressApiService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * 권한 체크
   */
  private async checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()
    assertPermission(settings.licenseCache, permission)
  }

  /**
   * 워드프레스 계정 목록 조회
   */
  async getAccounts(): Promise<WordPressAccount[]> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.getAccounts()
  }

  /**
   * 워드프레스 계정 생성
   */
  async createAccount(
    accountData: Omit<WordPressAccount, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WordPressAccount> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.createAccount(accountData)
  }

  /**
   * 워드프레스 계정 수정
   */
  async updateAccount(
    id: number,
    accountData: Partial<Omit<WordPressAccount, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<WordPressAccount> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.updateAccount(id, accountData)
  }

  /**
   * 워드프레스 계정 삭제
   */
  async deleteAccount(id: number): Promise<void> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.deleteAccount(id)
  }

  /**
   * 기본 워드프레스 계정 조회
   */
  async getDefaultAccount(): Promise<WordPressAccount | null> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.getDefaultAccount()
  }

  /**
   * 워드프레스 포스트 발행
   */
  async publishPost(accountId: number, postData: WordPressPostRequest): Promise<{ postId: number; url: string }> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.publishPost(account, postData)
  }

  /**
   * 워드프레스에 이미지 업로드
   */
  async uploadImage(accountId: number, imagePath: string): Promise<string> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.uploadImage(account, imagePath)
  }

  /**
   * 워드프레스 사이트 정보 조회
   */
  async getSiteInfo(accountId: number): Promise<any> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getSiteInfo(account)
  }

  /**
   * 워드프레스 카테고리 목록 조회
   */
  async getCategories(accountId: number, params?: WordPressCategoryListParams): Promise<WordPressCategory[]> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getCategories(account, params)
  }

  /**
   * 워드프레스 태그 목록 조회
   */
  async getTags(accountId: number, params?: WordPressTagListParams): Promise<WordPressTag[]> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getTags(account, params)
  }

  /**
   * 워드프레스 미디어 목록 조회
   */
  async getMedia(accountId: number, params?: WordPressMediaListParams): Promise<WordPressMedia[]> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getMedia(account, params)
  }

  /**
   * 워드프레스 태그 생성 또는 조회 (getOrCreate)
   */
  async getOrCreateTag(accountId: number, tagName: string): Promise<number> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getOrCreateTag(account, tagName)
  }

  /**
   * 워드프레스 카테고리 생성 또는 조회 (getOrCreate)
   */
  async getOrCreateCategory(accountId: number, categoryName: string): Promise<number> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getOrCreateCategory(account, categoryName)
  }

  /**
   * 워드프레스 미디어 URL 조회
   */
  async getMediaUrl(accountId: number, mediaId: number): Promise<string> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getMediaUrl(account, mediaId)
  }

  /**
   * 워드프레스 URL을 기반으로 미디어 ID 추출
   */
  async getMediaIdByUrl(accountId: number, mediaUrl: string): Promise<number | null> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getMediaIdByUrl(account, mediaUrl)
  }

  /**
   * 워드프레스 포스트 목록 조회
   */
  async getPosts(accountId: number, params?: WordPressPostListParams): Promise<WordPressPost[]> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getPosts(account, params)
  }

  /**
   * 워드프레스 포스트 조회 (단일)
   */
  async getPost(accountId: number, postId: number): Promise<WordPressPost> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getPost(account, postId)
  }

  /**
   * 워드프레스 포스트 생성
   */
  async createPost(accountId: number, postData: CreateWordPressPostRequest): Promise<WordPressPost> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.createPost(account, postData)
  }

  /**
   * 워드프레스 포스트 업데이트
   */
  async updatePost(accountId: number, postId: number, updateData: UpdateWordPressPostRequest): Promise<WordPressPost> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.updatePost(account, postId, updateData)
  }

  /**
   * 워드프레스 포스트 삭제
   */
  async deletePost(accountId: number, postId: number): Promise<void> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.deletePost(account, postId)
  }
}
