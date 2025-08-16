import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CreateNaverAccountDto } from './dto/create-naver-account.dto'
import { UpdateNaverAccountDto } from './dto/update-naver-account.dto'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class NaverAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllAccounts() {
    return this.prisma.naverAccount.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async getActiveAccounts() {
    return this.prisma.naverAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getAccountById(id: number) {
    const account = await this.prisma.naverAccount.findUnique({
      where: { id },
    })

    if (!account) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { id })
    }

    return account
  }

  async getAccountByNaverId(naverId: string) {
    return this.prisma.naverAccount.findUnique({
      where: { naverId },
    })
  }

  async createAccount(data: CreateNaverAccountDto) {
    const existing = await this.getAccountByNaverId(data.naverId)
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

  async updateAccount(id: number, data: UpdateNaverAccountDto) {
    await this.getAccountById(id)
    if (data.naverId) {
      const existing = await this.getAccountByNaverId(data.naverId)
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

  async updateLoginStatus(naverId: string, isLoggedIn: boolean, lastLogin?: Date) {
    const account = await this.getAccountByNaverId(naverId)
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
