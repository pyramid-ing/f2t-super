import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common'
import { NaverAccountService } from './naver-account.service'
import { CreateNaverAccountDto } from './dto/create-naver-account.dto'
import { UpdateNaverAccountDto } from './dto/update-naver-account.dto'

@Controller('naver-accounts')
export class NaverAccountController {
  constructor(private readonly naverAccountService: NaverAccountService) {}

  @Get()
  getAllAccounts() {
    return this.naverAccountService.getAllAccounts()
  }

  @Get('active')
  getActiveAccounts() {
    return this.naverAccountService.getActiveAccounts()
  }

  @Get(':id')
  getAccountById(@Param('id', ParseIntPipe) id: number) {
    return this.naverAccountService.getAccountById(id)
  }

  @Post()
  createAccount(@Body() createNaverAccountDto: CreateNaverAccountDto) {
    return this.naverAccountService.createAccount(createNaverAccountDto)
  }

  @Patch(':id')
  updateAccount(@Param('id', ParseIntPipe) id: number, @Body() updateNaverAccountDto: UpdateNaverAccountDto) {
    return this.naverAccountService.updateAccount(id, updateNaverAccountDto)
  }

  @Delete(':id')
  deleteAccount(@Param('id', ParseIntPipe) id: number) {
    return this.naverAccountService.deleteAccount(id)
  }

  @Post(':id/manual-login')
  async startManualLogin(@Param('id', ParseIntPipe) id: number) {
    const account = await this.naverAccountService.getAccountById(id)

    return this.naverAccountService.startManualLogin(account.naverId)
  }

  @Post(':id/check-login-status')
  async checkLoginStatus(@Param('id', ParseIntPipe) id: number) {
    const account = await this.naverAccountService.getAccountById(id)

    return this.naverAccountService.checkAndUpdateLoginStatus(account.naverId)
  }

  @Post('check-all-login-status')
  checkAllAccountsLoginStatus() {
    return this.naverAccountService.checkAllAccountsLoginStatus()
  }

  @Post(':id/logout')
  async logout(@Param('id', ParseIntPipe) id: number) {
    const account = await this.naverAccountService.getAccountById(id)

    return this.naverAccountService.logout(account.naverId)
  }
}
