import { Injectable, Logger } from '@nestjs/common'
import { WordPressAccount, WordPressPost } from './wordpress.types'
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
  async publishPost(accountId: number, postData: WordPressPost): Promise<{ postId: number; url: string }> {
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
  async getCategories(accountId: number, search?: string): Promise<any[]> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getCategories(account, search)
  }

  /**
   * 워드프레스 태그 목록 조회
   */
  async getTags(accountId: number, search?: string): Promise<any[]> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getTags(account, search)
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
}
