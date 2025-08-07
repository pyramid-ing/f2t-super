import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common'
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

  @Get('accounts/:accountId/categories')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async getCategories(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Query('search') search?: string,
  ): Promise<any[]> {
    return this.wordpressService.getCategories(accountId, search)
  }

  @Get('accounts/:accountId/tags')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async getTags(@Param('accountId', ParseIntPipe) accountId: number, @Query('search') search?: string): Promise<any[]> {
    return this.wordpressService.getTags(accountId, search)
  }

  @Post('accounts/:accountId/tags')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async getOrCreateTag(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() data: { name: string },
  ): Promise<{ id: number }> {
    const tagId = await this.wordpressService.getOrCreateTag(accountId, data.name)
    return { id: tagId }
  }

  @Post('accounts/:accountId/categories')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async getOrCreateCategory(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() data: { name: string },
  ): Promise<{ id: number }> {
    const categoryId = await this.wordpressService.getOrCreateCategory(accountId, data.name)
    return { id: categoryId }
  }

  @Get('accounts/:accountId/media/:mediaId/url')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async getMediaUrl(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
  ): Promise<{ url: string }> {
    const url = await this.wordpressService.getMediaUrl(accountId, mediaId)
    return { url }
  }

  @Post('accounts/:accountId/media/id')
  @Permissions(Permission.PUBLISH_WORDPRESS)
  async getMediaIdByUrl(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() data: { url: string },
  ): Promise<{ id: number | null }> {
    const mediaId = await this.wordpressService.getMediaIdByUrl(accountId, data.url)
    return { id: mediaId }
  }
}
