import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common'
import { TistoryService } from './tistory.service'
import { TistoryAccount } from './tistory.types'
import { CreateTistoryAccountDto, UpdateTistoryAccountDto } from './dto'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

@Controller('tistory')
@UseGuards(AuthGuard)
export class TistoryController {
  constructor(private readonly tistoryService: TistoryService) {}

  @Get('accounts')
  @Permissions(Permission.PUBLISH_TISTORY)
  async getAccounts(): Promise<TistoryAccount[]> {
    return this.tistoryService.getAccounts()
  }

  @Get('accounts/default')
  @Permissions(Permission.PUBLISH_TISTORY)
  async getDefaultAccount(): Promise<TistoryAccount | null> {
    return this.tistoryService.getDefaultAccount()
  }

  @Post('accounts')
  @Permissions(Permission.PUBLISH_TISTORY)
  async createAccount(@Body() accountData: CreateTistoryAccountDto): Promise<TistoryAccount> {
    return this.tistoryService.createAccount(accountData)
  }

  @Put('accounts/:id')
  @Permissions(Permission.PUBLISH_TISTORY)
  async updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() accountData: UpdateTistoryAccountDto,
  ): Promise<TistoryAccount> {
    return this.tistoryService.updateAccount(id, accountData)
  }

  @Delete('accounts/:id')
  @Permissions(Permission.PUBLISH_TISTORY)
  async deleteAccount(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tistoryService.deleteAccount(id)
  }
}
