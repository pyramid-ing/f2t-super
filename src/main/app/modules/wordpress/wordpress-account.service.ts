import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { normalizeBaseUrl } from '@main/app/utils'
import { WordPressAccount, WordPressVisibility } from './wordpress.types'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { UrlUpdateService } from '../common/utils/url-update.service'

@Injectable()
export class WordPressAccountService {
  private readonly logger = new Logger(WordPressAccountService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly urlUpdateService: UrlUpdateService,
  ) {}

  // URL 정규화는 공용 유틸을 사용합니다.

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
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
        message: '워드프레스 계정 목록을 가져오는데 실패했습니다.',
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
      // URL 중복 체크
      const normalizedUrl = normalizeBaseUrl(accountData.url)
      const existingAccount = await this.prisma.wordPressAccount.findFirst({
        where: { url: normalizedUrl },
      })

      if (existingAccount) {
        throw new CustomHttpException(ErrorCode.WORDPRESS_URL_DUPLICATE, {
          message: `이미 등록된 사이트 URL입니다: ${normalizedUrl}`,
          details: {
            existingAccountName: existingAccount.name,
            existingAccountId: existingAccount.id,
          },
        })
      }

      // 기존 계정 개수 확인
      const existingAccountsCount = await this.prisma.wordPressAccount.count()

      // isDefault가 없는 경우 자동으로 isDefault로 생성
      const shouldBeDefault = accountData.isDefault || existingAccountsCount === 0

      if (shouldBeDefault) {
        await this.prisma.wordPressAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      const account = await this.prisma.wordPressAccount.create({
        data: {
          name: accountData.name,
          desc: accountData.desc,
          url: normalizedUrl,
          wpUsername: accountData.wpUsername,
          apiKey: accountData.apiKey,
          isDefault: shouldBeDefault,
          defaultVisibility: accountData.defaultVisibility || WordPressVisibility.PUBLISH,
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
        defaultVisibility: (account.defaultVisibility as WordPressVisibility) || undefined,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      this.logger.error('워드프레스 계정 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
        message: '워드프레스 계정 생성에 실패했습니다.',
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
      // 기존 계정 조회
      const existingAccount = await this.prisma.wordPressAccount.findUnique({
        where: { id },
      })

      if (!existingAccount) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: '수정할 워드프레스 계정을 찾을 수 없습니다.',
        })
      }

      // isDefault가 true로 변경되는 경우 기존 기본 계정을 false로 변경
      if (accountData.isDefault) {
        await this.prisma.wordPressAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      // 기본 계정을 해제하려는 경우, 다른 계정이 있는지 확인
      if (accountData.isDefault === false && existingAccount.isDefault) {
        const otherAccounts = await this.prisma.wordPressAccount.findMany({
          where: { id: { not: id } },
        })

        if (otherAccounts.length === 0) {
          throw new CustomHttpException(ErrorCode.NO_DEFAULT_ACCOUNT)
        }

        // 다른 계정 중에 이미 기본 계정이 있는지 확인
        const existingDefaultAccount = otherAccounts.find(account => account.isDefault)

        // 다른 계정 중에 기본 계정이 없다면, 첫 번째 계정을 기본으로 설정
        if (!existingDefaultAccount) {
          await this.prisma.wordPressAccount.update({
            where: { id: otherAccounts[0].id },
            data: { isDefault: true },
          })
        }
      }

      const dataToUpdate: any = { ...accountData }
      if (typeof dataToUpdate.url === 'string') {
        const normalizedUrl = normalizeBaseUrl(dataToUpdate.url)

        // URL 중복 체크 (자신 제외)
        const existingAccount = await this.prisma.wordPressAccount.findFirst({
          where: {
            url: normalizedUrl,
            id: { not: id },
          },
        })

        if (existingAccount) {
          throw new CustomHttpException(ErrorCode.WORDPRESS_URL_DUPLICATE, {
            message: `이미 등록된 사이트 URL입니다: ${normalizedUrl}`,
            details: {
              existingAccountName: existingAccount.name,
              existingAccountId: existingAccount.id,
            },
          })
        }

        dataToUpdate.url = normalizedUrl
      }

      const updatedAccount = await this.prisma.wordPressAccount.update({
        where: { id },
        data: dataToUpdate,
      })

      // URL이 변경된 경우 기존 포스트들의 resultUrl 업데이트
      if (dataToUpdate.url !== undefined && dataToUpdate.url !== existingAccount.url) {
        await this.urlUpdateService.updateExistingPostUrls(id, existingAccount.url, dataToUpdate.url, 'wordpress')
      }

      // 수정 후 isDefault가 1개도 없는지 확인
      const defaultAccountsCount = await this.prisma.wordPressAccount.count({
        where: { isDefault: true },
      })

      if (defaultAccountsCount === 0) {
        throw new CustomHttpException(ErrorCode.NO_DEFAULT_ACCOUNT)
      }

      return {
        id: updatedAccount.id,
        name: updatedAccount.name,
        desc: updatedAccount.desc,
        url: updatedAccount.url,
        wpUsername: updatedAccount.wpUsername,
        apiKey: updatedAccount.apiKey,
        isDefault: updatedAccount.isDefault,
        defaultVisibility: (updatedAccount.defaultVisibility as WordPressVisibility) || undefined,
        createdAt: updatedAccount.createdAt,
        updatedAt: updatedAccount.updatedAt,
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      this.logger.error('워드프레스 계정 수정 실패:', error)
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
        message: '워드프레스 계정 수정에 실패했습니다.',
      })
    }
  }

  /**
   * 워드프레스 계정 삭제
   */
  async deleteAccount(id: number): Promise<void> {
    try {
      // 삭제할 계정 조회
      const accountToDelete = await this.prisma.wordPressAccount.findUnique({
        where: { id },
      })

      if (!accountToDelete) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: '삭제할 워드프레스 계정을 찾을 수 없습니다.',
        })
      }

      // isDefault 상관없이 삭제 가능
      await this.prisma.wordPressAccount.delete({
        where: { id },
      })
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      this.logger.error('워드프레스 계정 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
        message: '워드프레스 계정 삭제에 실패했습니다.',
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
        defaultVisibility: (account.defaultVisibility as WordPressVisibility) || undefined,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    } catch (error) {
      this.logger.error('기본 워드프레스 계정 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
        message: '기본 워드프레스 계정을 가져오는데 실패했습니다.',
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
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, {
        message: '워드프레스 계정을 가져오는데 실패했습니다.',
      })
    }
  }
}
