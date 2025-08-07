import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { WordPressAccount } from './wordpress.types'

// WordPressAccountError 클래스 정의
class WordPressAccountErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'WordPressAccountError'
  }
}

@Injectable()
export class WordPressAccountService {
  private readonly logger = new Logger(WordPressAccountService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 워드프레스 계정 목록 조회
   */
  async getAccounts(): Promise<WordPressAccount[]> {
    try {
      const accounts = await this.prisma.wordPressAccount.findMany({
        orderBy: { createdAt: 'desc' },
      })

      return accounts.map(account => ({
        id: account.id,
        name: account.name,
        desc: account.desc,
        url: account.url,
        wpUsername: account.wpUsername,
        apiKey: account.apiKey,
        isDefault: account.isDefault,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }))
    } catch (error) {
      this.logger.error('워드프레스 계정 목록 조회 실패:', error)
      throw new WordPressAccountErrorClass({
        code: 'ACCOUNTS_FETCH_FAILED',
        message: '워드프레스 계정 목록을 가져오는데 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스 계정 생성
   */
  async createAccount(
    accountData: Omit<WordPressAccount, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WordPressAccount> {
    try {
      // isDefault가 true인 경우 기존 기본 계정을 false로 변경
      if (accountData.isDefault) {
        await this.prisma.wordPressAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      const account = await this.prisma.wordPressAccount.create({
        data: {
          name: accountData.name,
          desc: accountData.desc,
          url: accountData.url,
          wpUsername: accountData.wpUsername,
          apiKey: accountData.apiKey,
          isDefault: accountData.isDefault,
        },
      })

      return {
        id: account.id,
        name: account.name,
        desc: account.desc,
        url: account.url,
        wpUsername: account.wpUsername,
        apiKey: account.apiKey,
        isDefault: account.isDefault,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('워드프레스 계정 생성 실패:', error)
      throw new WordPressAccountErrorClass({
        code: 'ACCOUNT_CREATION_FAILED',
        message: '워드프레스 계정 생성에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스 계정 수정
   */
  async updateAccount(
    id: number,
    accountData: Partial<Omit<WordPressAccount, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<WordPressAccount> {
    try {
      // isDefault가 true로 변경되는 경우 기존 기본 계정을 false로 변경
      if (accountData.isDefault) {
        await this.prisma.wordPressAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      const account = await this.prisma.wordPressAccount.update({
        where: { id },
        data: accountData,
      })

      return {
        id: account.id,
        name: account.name,
        desc: account.desc,
        url: account.url,
        wpUsername: account.wpUsername,
        apiKey: account.apiKey,
        isDefault: account.isDefault,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('워드프레스 계정 수정 실패:', error)
      throw new WordPressAccountErrorClass({
        code: 'ACCOUNT_UPDATE_FAILED',
        message: '워드프레스 계정 수정에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스 계정 삭제
   */
  async deleteAccount(id: number): Promise<void> {
    try {
      await this.prisma.wordPressAccount.delete({
        where: { id },
      })
    } catch (error) {
      this.logger.error('워드프레스 계정 삭제 실패:', error)
      throw new WordPressAccountErrorClass({
        code: 'ACCOUNT_DELETION_FAILED',
        message: '워드프레스 계정 삭제에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 기본 워드프레스 계정 조회
   */
  async getDefaultAccount(): Promise<WordPressAccount | null> {
    try {
      const account = await this.prisma.wordPressAccount.findFirst({
        where: { isDefault: true },
      })

      if (!account) {
        return null
      }

      return {
        id: account.id,
        name: account.name,
        desc: account.desc,
        url: account.url,
        wpUsername: account.wpUsername,
        apiKey: account.apiKey,
        isDefault: account.isDefault,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('기본 워드프레스 계정 조회 실패:', error)
      throw new WordPressAccountErrorClass({
        code: 'DEFAULT_ACCOUNT_FETCH_FAILED',
        message: '기본 워드프레스 계정을 가져오는데 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * ID로 워드프레스 계정 조회
   */
  async getAccountById(id: number): Promise<WordPressAccount | null> {
    try {
      const account = await this.prisma.wordPressAccount.findUnique({
        where: { id },
      })

      if (!account) {
        return null
      }

      return {
        id: account.id,
        name: account.name,
        desc: account.desc,
        url: account.url,
        wpUsername: account.wpUsername,
        apiKey: account.apiKey,
        isDefault: account.isDefault,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('워드프레스 계정 조회 실패:', error)
      throw new WordPressAccountErrorClass({
        code: 'ACCOUNT_FETCH_FAILED',
        message: '워드프레스 계정을 가져오는데 실패했습니다.',
        details: error,
      })
    }
  }
}
