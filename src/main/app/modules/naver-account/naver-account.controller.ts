import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common'
import { NaverAccountService } from './naver-account.service'
import { CreateNaverAccountDto } from './dto/create-naver-account.dto'
import { UpdateNaverAccountDto } from './dto/update-naver-account.dto'

@Controller('naver-accounts')
export class NaverAccountController {
  constructor(private readonly naverAccountService: NaverAccountService) {}

  @Get()
  async getAllAccounts() {
    return this.naverAccountService.getAllAccounts()
  }

  @Get('active')
  async getActiveAccounts() {
    return this.naverAccountService.getActiveAccounts()
  }

  @Get(':id')
  async getAccountById(@Param('id') id: string) {
    return this.naverAccountService.getAccountById(Number(id))
  }

  @Post()
  async createAccount(@Body() data: CreateNaverAccountDto) {
    return this.naverAccountService.createAccount(data)
  }

  @Put(':id')
  async updateAccount(@Param('id') id: string, @Body() data: UpdateNaverAccountDto) {
    return this.naverAccountService.updateAccount(Number(id), data)
  }

  @Delete(':id')
  async deleteAccount(@Param('id') id: string) {
    return this.naverAccountService.deleteAccount(Number(id))
  }
}
