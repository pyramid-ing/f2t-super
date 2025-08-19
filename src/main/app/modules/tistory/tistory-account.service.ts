import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { normalizeBaseUrl, validateTistoryUrl } from '@main/app/utils'
import { TistoryAccount } from './tistory.types'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class TistoryAccountService {
  private readonly logger = new Logger(TistoryAccountService.name)

  constructor(private readonly prisma: PrismaService) {}

  // URL 정규화는 공용 유틸을 사용합니다.

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
        url: account.url,
        loginId: account.loginId,
        loginPassword: account.loginPassword,
        isDefault: account.isDefault,
        defaultVisibility: account.defaultVisibility,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }))
    } catch (error) {
      this.logger.error('티스토리 계정 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
        message: '티스토리 계정 목록을 가져오는데 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 티스토리 계정 생성
   */
  async createAccount(account: Omit<TistoryAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<TistoryAccount> {
    try {
      // isDefault가 true인 경우 기존 기본 계정을 false로 변경
      if (account.isDefault) {
        await this.prisma.tistoryAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      const tistoryAccount = await this.prisma.tistoryAccount.create({
        data: {
          name: account.name,
          desc: account.desc,
          tistoryUrl: normalizeBaseUrl(account.tistoryUrl)!,
          url: normalizeBaseUrl(account.url) || null,
          loginId: account.loginId,
          loginPassword: account.loginPassword,
          isDefault: account.isDefault,
          defaultVisibility: account.defaultVisibility || undefined,
        },
      })

      return {
        id: tistoryAccount.id,
        name: tistoryAccount.name,
        desc: tistoryAccount.desc,
        tistoryUrl: tistoryAccount.tistoryUrl,
        url: tistoryAccount.url || undefined,
        loginId: tistoryAccount.loginId,
        loginPassword: tistoryAccount.loginPassword,
        isDefault: tistoryAccount.isDefault,
        createdAt: tistoryAccount.createdAt,
        updatedAt: tistoryAccount.updatedAt,
      }
    } catch (error) {
      this.logger.error('티스토리 계정 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
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
      // 티스토리 URL이 제공된 경우 검증 (서비스 레벨에서 추가 검증)
      if (accountData.tistoryUrl && !validateTistoryUrl(accountData.tistoryUrl)) {
        throw new CustomHttpException(ErrorCode.INVALID_INPUT, {
          message: '티스토리 URL은 tistory.com 도메인을 포함해야 합니다.',
          details: { tistoryUrl: accountData.tistoryUrl },
        })
      }

      // isDefault가 true로 변경되는 경우 기존 기본 계정을 false로 변경
      if (accountData.isDefault) {
        await this.prisma.tistoryAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      const dataToUpdate: any = { ...accountData }
      if (typeof dataToUpdate.tistoryUrl === 'string') {
        dataToUpdate.tistoryUrl = normalizeBaseUrl(dataToUpdate.tistoryUrl)
      }
      if (typeof dataToUpdate.url === 'string') {
        dataToUpdate.url = normalizeBaseUrl(dataToUpdate.url)
      }

      const account = await this.prisma.tistoryAccount.update({
        where: { id },
        data: dataToUpdate,
      })

      return {
        id: account.id,
        name: account.name,
        desc: account.desc,
        tistoryUrl: account.tistoryUrl,
        url: account.url || undefined,
        loginId: account.loginId,
        loginPassword: account.loginPassword,
        isDefault: account.isDefault,
        defaultVisibility: account.defaultVisibility || undefined,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      this.logger.error('티스토리 계정 수정 실패:', error)
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
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
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
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
        url: account.url || undefined,
        loginId: account.loginId,
        loginPassword: account.loginPassword,
        isDefault: account.isDefault,
        defaultVisibility: account.defaultVisibility,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('기본 티스토리 계정 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
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
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
        message: '티스토리 계정을 가져오는데 실패했습니다.',
        details: error,
      })
    }
  }
}
