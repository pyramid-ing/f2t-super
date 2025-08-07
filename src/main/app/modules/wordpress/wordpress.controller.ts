import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common'
import { WordPressService } from './wordpress.service'
import { WordPressAccount } from './wordpress.types'
import { CreateWordPressAccountDto, UpdateWordPressAccountDto } from './dto'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

@Controller('wordpress')
@UseGuards(AuthGuard)
export class WordPressController {
  constructor(private readonly wordpressService: WordPressService) {}

  @Get('accounts')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async getAccounts(): Promise<WordPressAccount[]> {
    return this.wordpressService.getAccounts()
  }

  @Get('accounts/default')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async getDefaultAccount(): Promise<WordPressAccount | null> {
    return this.wordpressService.getDefaultAccount()
  }

  @Post('accounts')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async createAccount(@Body() accountData: CreateWordPressAccountDto): Promise<WordPressAccount> {
    return this.wordpressService.createAccount(accountData)
  }

  @Put('accounts/:id')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() accountData: UpdateWordPressAccountDto,
  ): Promise<WordPressAccount> {
    return this.wordpressService.updateAccount(id, accountData)
  }

  @Delete('accounts/:id')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async deleteAccount(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.wordpressService.deleteAccount(id)
  }
}
