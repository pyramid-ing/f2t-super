import { Injectable, Logger } from '@nestjs/common'
import { WordPressAccount, WordPressPostRequest } from './wordpress.types'

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
   * 워드프레스 계정 목록 조회
   */
  public async getAccounts(): Promise<WordPressAccount[]> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.getAccounts()
  }

  /**
   * 워드프레스 계정 생성
   */
  public async createAccount(
    accountData: Omit<WordPressAccount, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WordPressAccount> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.createAccount(accountData)
  }

  /**
   * 워드프레스 계정 수정
   */
  public async updateAccount(
    id: number,
    accountData: Partial<Omit<WordPressAccount, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<WordPressAccount> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.updateAccount(id, accountData)
  }

  /**
   * 워드프레스 계정 삭제
   */
  public async deleteAccount(id: number): Promise<void> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.deleteAccount(id)
  }

  /**
   * 기본 워드프레스 계정 조회
   */
  public async getDefaultAccount(): Promise<WordPressAccount | null> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)
    return this.accountService.getDefaultAccount()
  }

  /**
   * 워드프레스 포스트 발행
   */
  public async publishPost(
    accountId: number,
    postData: WordPressPostRequest,
  ): Promise<{ postId: number; url: string }> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.publishPost(account, postData)
  }

  /**
   * 워드프레스에 이미지 업로드
   */
  public async uploadImage(accountId: number, imagePath: string): Promise<string> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.uploadImage(account, imagePath)
  }

  /**
   * 워드프레스 태그 생성 또는 조회 (getOrCreate)
   */
  public async getOrCreateTag(accountId: number, tagName: string): Promise<number> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getOrCreateTag(account, tagName)
  }

  /**
   * 워드프레스 카테고리 생성 또는 조회 (getOrCreate)
   */
  public async getOrCreateCategory(accountId: number, categoryName: string): Promise<number> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getOrCreateCategory(account, categoryName)
  }

  /**
   * 워드프레스 URL을 기반으로 미디어 ID 추출
   */
  public async getMediaIdByUrl(accountId: number, mediaUrl: string): Promise<number | null> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.getMediaIdByUrl(account, mediaUrl)
  }

  /**
   * 워드프레스 API 유효성 체크
   */
  public async validateApiKey(accountId: number): Promise<boolean> {
    await this._checkPermission(Permission.PUBLISH_WORDPRESS)

    const account = await this.accountService.getAccountById(accountId)
    if (!account) {
      throw new Error('워드프레스 계정을 찾을 수 없습니다.')
    }

    return this.apiService.validateApiKey(account)
  }

  /**
   * 권한 체크
   */
  private async _checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()
    assertPermission(settings.licenseCache, permission)
  }
}
