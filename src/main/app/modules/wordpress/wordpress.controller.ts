import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common'
import { WordPressService } from './wordpress.service'
import { WordPressAccount } from './wordpress.types'
import { CreateWordPressAccountDto, UpdateWordPressAccountDto } from './dto'

@Controller('wordpress')
export class WordPressController {
  constructor(private readonly wordpressService: WordPressService) {}

  @Get('accounts')
  async getAccounts(): Promise<WordPressAccount[]> {
    return this.wordpressService.getAccounts()
  }

  @Get('accounts/default')
  async getDefaultAccount(): Promise<WordPressAccount | null> {
    return this.wordpressService.getDefaultAccount()
  }

  @Post('accounts')
  async createAccount(@Body() accountData: CreateWordPressAccountDto): Promise<WordPressAccount> {
    return this.wordpressService.createAccount(accountData)
  }

  @Put('accounts/:id')
  async updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() accountData: UpdateWordPressAccountDto,
  ): Promise<WordPressAccount> {
    return this.wordpressService.updateAccount(id, accountData)
  }

  @Delete('accounts/:id')
  async deleteAccount(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.wordpressService.deleteAccount(id)
  }
}
