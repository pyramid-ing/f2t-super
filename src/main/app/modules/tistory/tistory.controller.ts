import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common'
import { TistoryService } from './tistory.service'
import { TistoryAccount } from './tistory.types'
import { CreateTistoryAccountDto, UpdateTistoryAccountDto } from './dto'

@Controller('tistory')
export class TistoryController {
  constructor(private readonly tistoryService: TistoryService) {}

  @Get('accounts')
  async getAccounts(): Promise<TistoryAccount[]> {
    return this.tistoryService.getAccounts()
  }

  @Get('accounts/default')
  async getDefaultAccount(): Promise<TistoryAccount | null> {
    return this.tistoryService.getDefaultAccount()
  }

  @Post('accounts')
  async createAccount(@Body() accountData: CreateTistoryAccountDto): Promise<TistoryAccount> {
    return this.tistoryService.createAccount(accountData)
  }

  @Put('accounts/:id')
  async updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() accountData: UpdateTistoryAccountDto,
  ): Promise<TistoryAccount> {
    return this.tistoryService.updateAccount(id, accountData)
  }

  @Delete('accounts/:id')
  async deleteAccount(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tistoryService.deleteAccount(id)
  }
}
