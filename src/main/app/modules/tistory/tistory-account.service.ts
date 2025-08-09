import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { TistoryAccount } from './tistory.types'

// TistoryAccountError 클래스 정의
class TistoryAccountErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'TistoryAccountError'
  }
}

@Injectable()
export class TistoryAccountService {
  private readonly logger = new Logger(TistoryAccountService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 티스토리 계정 목록 조회
   */
  async getAccounts(): Promise<TistoryAccount[]> {
    try {
      const accounts = await this.prisma.tistoryAccount.findMany({
        orderBy: { createdAt: 'desc' },
      })

      return accounts.map(account => ({
        id: account.id,
        name: account.name,
        desc: account.desc,
        tistoryUrl: account.tistoryUrl,
        loginId: account.loginId,
        loginPassword: account.loginPassword,
        isDefault: account.isDefault,
        defaultVisibility: account.defaultVisibility,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }))
    } catch (error) {
      this.logger.error('티스토리 계정 목록 조회 실패:', error)
      throw new TistoryAccountErrorClass({
        code: 'ACCOUNTS_FETCH_FAILED',
        message: '티스토리 계정 목록을 가져오는데 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 티스토리 계정 생성
   */
  async createAccount(accountData: Omit<TistoryAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<TistoryAccount> {
    try {
      // isDefault가 true인 경우 기존 기본 계정을 false로 변경
      if (accountData.isDefault) {
        await this.prisma.tistoryAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      const account = await this.prisma.tistoryAccount.create({
        data: {
          name: accountData.name,
          desc: accountData.desc,
          tistoryUrl: accountData.tistoryUrl,
          loginId: accountData.loginId,
          loginPassword: accountData.loginPassword,
          isDefault: accountData.isDefault,
          defaultVisibility: accountData.defaultVisibility || undefined,
        },
      })

      return {
        id: account.id,
        name: account.name,
        desc: account.desc,
        tistoryUrl: account.tistoryUrl,
        loginId: account.loginId,
        loginPassword: account.loginPassword,
        isDefault: account.isDefault,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('티스토리 계정 생성 실패:', error)
      throw new TistoryAccountErrorClass({
        code: 'ACCOUNT_CREATION_FAILED',
        message: '티스토리 계정 생성에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 티스토리 계정 수정
   */
  async updateAccount(
    id: number,
    accountData: Partial<Omit<TistoryAccount, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<TistoryAccount> {
    try {
      // isDefault가 true로 변경되는 경우 기존 기본 계정을 false로 변경
      if (accountData.isDefault) {
        await this.prisma.tistoryAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      const account = await this.prisma.tistoryAccount.update({
        where: { id },
        data: accountData,
      })

      return {
        id: account.id,
        name: account.name,
        desc: account.desc,
        tistoryUrl: account.tistoryUrl,
        loginId: account.loginId,
        loginPassword: account.loginPassword,
        isDefault: account.isDefault,
        defaultVisibility: account.defaultVisibility || undefined,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('티스토리 계정 수정 실패:', error)
      throw new TistoryAccountErrorClass({
        code: 'ACCOUNT_UPDATE_FAILED',
        message: '티스토리 계정 수정에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 티스토리 계정 삭제
   */
  async deleteAccount(id: number): Promise<void> {
    try {
      await this.prisma.tistoryAccount.delete({
        where: { id },
      })
    } catch (error) {
      this.logger.error('티스토리 계정 삭제 실패:', error)
      throw new TistoryAccountErrorClass({
        code: 'ACCOUNT_DELETION_FAILED',
        message: '티스토리 계정 삭제에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 기본 티스토리 계정 조회
   */
  async getDefaultAccount(): Promise<TistoryAccount | null> {
    try {
      const account = await this.prisma.tistoryAccount.findFirst({
        where: { isDefault: true },
      })

      if (!account) {
        return null
      }

      return {
        id: account.id,
        name: account.name,
        desc: account.desc,
        tistoryUrl: account.tistoryUrl,
        loginId: account.loginId,
        loginPassword: account.loginPassword,
        isDefault: account.isDefault,
        defaultVisibility: account.defaultVisibility,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('기본 티스토리 계정 조회 실패:', error)
      throw new TistoryAccountErrorClass({
        code: 'DEFAULT_ACCOUNT_FETCH_FAILED',
        message: '기본 티스토리 계정을 가져오는데 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * ID로 티스토리 계정 조회
   */
  async getAccountById(id: number): Promise<TistoryAccount | null> {
    try {
      const account = await this.prisma.tistoryAccount.findUnique({
        where: { id },
      })

      if (!account) {
        return null
      }

      return {
        id: account.id,
        name: account.name,
        desc: account.desc,
        tistoryUrl: account.tistoryUrl,
        loginId: account.loginId,
        loginPassword: account.loginPassword,
        isDefault: account.isDefault,
        defaultVisibility: account.defaultVisibility,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('티스토리 계정 조회 실패:', error)
      throw new TistoryAccountErrorClass({
        code: 'ACCOUNT_FETCH_FAILED',
        message: '티스토리 계정을 가져오는데 실패했습니다.',
        details: error,
      })
    }
  }
}
