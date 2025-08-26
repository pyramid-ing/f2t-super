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
      // 기존 계정 개수 확인
      const existingAccountsCount = await this.prisma.tistoryAccount.count()

      // 최초 계정이거나 isDefault가 true인 경우 기존 기본 계정을 false로 변경
      const shouldBeDefault = account.isDefault || existingAccountsCount === 0

      if (shouldBeDefault) {
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
          isDefault: shouldBeDefault,
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
      // 기존 계정 조회
      const existingAccount = await this.prisma.tistoryAccount.findUnique({
        where: { id },
      })

      if (!existingAccount) {
        throw new CustomHttpException(ErrorCode.NOT_FOUND, {
          message: '수정할 티스토리 계정을 찾을 수 없습니다.',
        })
      }

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

      // 기본 계정을 해제하려는 경우, 다른 계정이 있는지 확인
      if (accountData.isDefault === false && existingAccount.isDefault) {
        const otherAccounts = await this.prisma.tistoryAccount.findMany({
          where: { id: { not: id } },
        })

        if (otherAccounts.length === 0) {
          throw new CustomHttpException(ErrorCode.NO_DEFAULT_ACCOUNT)
        }

        // 다른 계정 중에 이미 기본 계정이 있는지 확인
        const existingDefaultAccount = otherAccounts.find(account => account.isDefault)

        // 다른 계정 중에 기본 계정이 없다면, 첫 번째 계정을 기본으로 설정
        if (!existingDefaultAccount) {
          await this.prisma.tistoryAccount.update({
            where: { id: otherAccounts[0].id },
            data: { isDefault: true },
          })
        }
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

      // 수정 후 isDefault가 1개도 없는지 확인
      const defaultAccountsCount = await this.prisma.tistoryAccount.count({
        where: { isDefault: true },
      })

      if (defaultAccountsCount === 0) {
        throw new CustomHttpException(ErrorCode.NO_DEFAULT_ACCOUNT, {
          message: '기본 블로그 1개는 필수입니다.',
        })
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
      // 삭제할 계정 조회
      const accountToDelete = await this.prisma.tistoryAccount.findUnique({
        where: { id },
      })

      if (!accountToDelete) {
        throw new CustomHttpException(ErrorCode.NOT_FOUND, {
          message: '삭제할 티스토리 계정을 찾을 수 없습니다.',
        })
      }

      // 기본 계정인지 확인
      if (accountToDelete.isDefault) {
        // 다른 계정이 있는지 확인
        const otherAccounts = await this.prisma.tistoryAccount.findMany({
          where: { id: { not: id } },
        })

        if (otherAccounts.length === 0) {
          throw new CustomHttpException(ErrorCode.NO_DEFAULT_ACCOUNT, {
            message: '기본 블로그 1개는 필수입니다.',
          })
        }

        // 다른 계정 중 첫 번째를 기본으로 설정
        await this.prisma.tistoryAccount.update({
          where: { id: otherAccounts[0].id },
          data: { isDefault: true },
        })
      }

      await this.prisma.tistoryAccount.delete({
        where: { id },
      })
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
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
