import { Injectable, Logger } from '@nestjs/common'
import { WordPressAccount, WordPressPost } from './wordpress.types'
import { WordPressAccountService } from './wordpress-account.service'
import { WordPressApiService } from './wordpress-api.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { assertPermission } from '@main/app/utils/permission.assert'

// WordPressError 클래스 정의
class WordPressErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'WordPressError'
  }
}

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

    try {
      const account = await this.accountService.getAccountById(accountId)
      if (!account) {
        throw new Error('워드프레스 계정을 찾을 수 없습니다.')
      }

      return this.apiService.publishPost(account, postData)
    } catch (error) {
      this.logger.error('워드프레스 포스트 발행 실패:', error)
      throw new WordPressErrorClass({
        code: 'POST_PUBLISH_FAILED',
        message: '워드프레스 포스트 발행에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스에 이미지 업로드
   */
  async uploadImage(accountId: number, imagePath: string): Promise<string> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    try {
      const account = await this.accountService.getAccountById(accountId)
      if (!account) {
        throw new Error('워드프레스 계정을 찾을 수 없습니다.')
      }

      return this.apiService.uploadImage(account, imagePath)
    } catch (error) {
      this.logger.error('워드프레스 이미지 업로드 실패:', error)
      throw new WordPressErrorClass({
        code: 'IMAGE_UPLOAD_FAILED',
        message: '워드프레스 이미지 업로드에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스 사이트 정보 조회
   */
  async getSiteInfo(accountId: number): Promise<any> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    try {
      const account = await this.accountService.getAccountById(accountId)
      if (!account) {
        throw new Error('워드프레스 계정을 찾을 수 없습니다.')
      }

      return this.apiService.getSiteInfo(account)
    } catch (error) {
      this.logger.error('워드프레스 사이트 정보 조회 실패:', error)
      throw new WordPressErrorClass({
        code: 'SITE_INFO_FAILED',
        message: '워드프레스 사이트 정보 조회에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스 카테고리 목록 조회
   */
  async getCategories(accountId: number): Promise<any[]> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    try {
      const account = await this.accountService.getAccountById(accountId)
      if (!account) {
        throw new Error('워드프레스 계정을 찾을 수 없습니다.')
      }

      return this.apiService.getCategories(account)
    } catch (error) {
      this.logger.error('워드프레스 카테고리 목록 조회 실패:', error)
      throw new WordPressErrorClass({
        code: 'CATEGORIES_FAILED',
        message: '워드프레스 카테고리 목록 조회에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스 태그 목록 조회
   */
  async getTags(accountId: number): Promise<any[]> {
    await this.checkPermission(Permission.PUBLISH_WORDPRESS)

    try {
      const account = await this.accountService.getAccountById(accountId)
      if (!account) {
        throw new Error('워드프레스 계정을 찾을 수 없습니다.')
      }

      return this.apiService.getTags(account)
    } catch (error) {
      this.logger.error('워드프레스 태그 목록 조회 실패:', error)
      throw new WordPressErrorClass({
        code: 'TAGS_FAILED',
        message: '워드프레스 태그 목록 조회에 실패했습니다.',
        details: error,
      })
    }
  }
}
