import { Injectable, Logger } from '@nestjs/common'
import { TistoryAccount, TistoryPostOptions } from './tistory.types'
import { TistoryAccountService } from './tistory-account.service'
import { TistoryAutomationService } from './tistory-automation.service'

// TistoryError 클래스 정의
class TistoryErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'TistoryError'
  }
}

@Injectable()
export class TistoryService {
  private readonly logger = new Logger(TistoryService.name)

  constructor(
    private readonly accountService: TistoryAccountService,
    private readonly automationService: TistoryAutomationService,
  ) {}

  /**
   * 티스토리 계정 목록 조회
   */
  async getAccounts(): Promise<TistoryAccount[]> {
    return this.accountService.getAccounts()
  }

  /**
   * 티스토리 계정 생성
   */
  async createAccount(accountData: Omit<TistoryAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<TistoryAccount> {
    return this.accountService.createAccount(accountData)
  }

  /**
   * 티스토리 계정 수정
   */
  async updateAccount(
    id: number,
    accountData: Partial<Omit<TistoryAccount, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<TistoryAccount> {
    return this.accountService.updateAccount(id, accountData)
  }

  /**
   * 티스토리 계정 삭제
   */
  async deleteAccount(id: number): Promise<void> {
    return this.accountService.deleteAccount(id)
  }

  /**
   * 기본 티스토리 계정 조회
   */
  async getDefaultAccount(): Promise<TistoryAccount | null> {
    return this.accountService.getDefaultAccount()
  }

  /**
   * 티스토리 포스트 발행
   */
  async publishPost(
    accountId: number,
    postData: TistoryPostOptions,
  ): Promise<{ success: boolean; message: string; url?: string }> {
    try {
      const account = await this.accountService.getAccountById(accountId)
      if (!account) {
        throw new Error('티스토리 계정을 찾을 수 없습니다.')
      }

      return this.automationService.publish({
        ...postData,
        url: account.tistoryUrl,
      })
    } catch (error) {
      this.logger.error('티스토리 포스트 발행 실패:', error)
      throw new TistoryErrorClass({
        code: 'POST_PUBLISH_FAILED',
        message: '티스토리 포스트 발행에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 티스토리에 이미지 업로드
   */
  async uploadImages(accountId: number, imagePaths: string[]): Promise<string[]> {
    try {
      const account = await this.accountService.getAccountById(accountId)
      if (!account) {
        throw new Error('티스토리 계정을 찾을 수 없습니다.')
      }
      account.name

      return this.automationService.uploadImagesWithBrowser(imagePaths, account.tistoryUrl, account.loginId)
    } catch (error) {
      this.logger.error('티스토리 이미지 업로드 실패:', error)
      throw new TistoryErrorClass({
        code: 'IMAGE_UPLOAD_FAILED',
        message: '티스토리 이미지 업로드에 실패했습니다.',
        details: error,
      })
    }
  }
}
