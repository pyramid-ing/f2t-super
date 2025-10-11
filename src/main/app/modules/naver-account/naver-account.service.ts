import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CreateNaverAccountDto } from './dto/create-naver-account.dto'
import { UpdateNaverAccountDto } from './dto/update-naver-account.dto'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { NaverAuthService } from '../naver-auth/naver-auth.service'

@Injectable()
export class NaverAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly naverAuthService: NaverAuthService,
  ) {}

  public async getAllAccounts() {
    return this.prisma.naverAccount.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  public async getActiveAccounts() {
    return this.prisma.naverAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  public async getAccountById(id: number) {
    const account = await this.prisma.naverAccount.findUnique({
      where: { id },
    })

    if (!account) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { id })
    }

    return account
  }

  public async createAccount(data: CreateNaverAccountDto) {
    const existing = await this._getAccountByNaverId(data.naverId)
    if (existing) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_DUPLICATE, { naverId: data.naverId })
    }

    return this.prisma.naverAccount.create({
      data: {
        name: data.name,
        naverId: data.naverId,
        password: data.password,
        isActive: data.isActive ?? true,
      },
    })
  }

  public async updateAccount(id: number, data: UpdateNaverAccountDto) {
    await this.getAccountById(id)
    if (data.naverId) {
      const existing = await this._getAccountByNaverId(data.naverId)
      if (existing && existing.id !== id) {
        throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_DUPLICATE, { naverId: data.naverId })
      }
    }

    return this.prisma.naverAccount.update({
      where: { id },
      data,
    })
  }

  async deleteAccount(id: number) {
    await this.getAccountById(id)

    await this.prisma.naverAccount.delete({
      where: { id },
    })

    return { success: true, message: '네이버 계정이 삭제되었습니다.' }
  }

  /**
   * 수동 로그인을 위한 브라우저 창을 열고 로그인 완료를 기다립니다
   */
  public async startManualLogin(naverId: string): Promise<{ success: boolean; message: string }> {
    const account = await this._getAccountByNaverId(naverId)
    if (!account) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { naverId })
    }

    const result = await this.naverAuthService.startManualLogin(naverId, account.password)

    if (result.success) {
      // 실제 로그인 상태 확인 후 DB 업데이트
      const loginStatus = await this.naverAuthService.checkAndUpdateLoginStatus(naverId)
      await this._updateLoginStatus(naverId, loginStatus.isLoggedIn, new Date())
    }

    return result
  }

  /**
   * 실제 로그인 상태를 확인하고 DB를 업데이트합니다
   */
  public async checkAndUpdateLoginStatus(naverId: string): Promise<{ isLoggedIn: boolean; message: string }> {
    const account = await this._getAccountByNaverId(naverId)
    if (!account) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { naverId })
    }

    const loginStatus = await this.naverAuthService.checkAndUpdateLoginStatus(naverId)

    // DB 업데이트
    await this._updateLoginStatus(
      naverId,
      loginStatus.isLoggedIn,
      loginStatus.isLoggedIn ? new Date() : account.lastLogin,
    )

    return loginStatus
  }

  /**
   * 모든 계정의 실제 로그인 상태를 확인하고 DB를 업데이트합니다
   */
  public async checkAllAccountsLoginStatus(): Promise<
    { accountId: number; naverId: string; isLoggedIn: boolean; message: string }[]
  > {
    const accounts = await this.getAllAccounts()
    const results = []

    for (const account of accounts) {
      try {
        const status = await this.checkAndUpdateLoginStatus(account.naverId)
        results.push({
          accountId: account.id,
          naverId: account.naverId,
          isLoggedIn: status.isLoggedIn,
          message: status.message,
        })
      } catch (error) {
        console.error(`계정 ${account.naverId} 로그인 상태 확인 실패:`, error)
        results.push({
          accountId: account.id,
          naverId: account.naverId,
          isLoggedIn: false,
          message: '로그인 상태 확인 실패',
        })
      }
    }

    return results
  }

  /**
   * 로그아웃 처리 (쿠키 삭제 및 로그인 상태 업데이트)
   */
  public async logout(naverId: string): Promise<{ success: boolean; message: string }> {
    const account = await this._getAccountByNaverId(naverId)
    if (!account) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { naverId })
    }

    // 쿠키 삭제
    const deleteResult = this.naverAuthService.deleteCookie(naverId)

    // DB의 로그인 상태를 false로 업데이트
    await this._updateLoginStatus(naverId, false)

    return {
      success: deleteResult.success,
      message: deleteResult.success ? '로그아웃이 완료되었습니다.' : deleteResult.message,
    }
  }

  private async _getAccountByNaverId(naverId: string) {
    return this.prisma.naverAccount.findUnique({
      where: { naverId },
    })
  }

  private async _updateLoginStatus(naverId: string, isLoggedIn: boolean, lastLogin?: Date) {
    const account = await this._getAccountByNaverId(naverId)
    if (!account) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { naverId })
    }

    return this.prisma.naverAccount.update({
      where: { naverId },
      data: {
        isLoggedIn,
        lastLogin: lastLogin || (isLoggedIn ? new Date() : account.lastLogin),
      },
    })
  }
}
