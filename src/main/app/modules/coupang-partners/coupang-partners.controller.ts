import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common'
import { CoupangPartnersService } from './coupang-partners.service'
import { CoupangAffiliateLink } from './coupang-partners.types'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

export class CreateAffiliateLinkDto {
  coupangUrl: string
}

export class GetProductInfoDto {
  coupangUrl: string
}

@Controller('coupang-partners')
@UseGuards(AuthGuard)
export class CoupangPartnersController {
  constructor(private readonly coupangPartnersService: CoupangPartnersService) {}

  /**
   * 어필리에이트 링크 생성
   */
  @Post('affiliate-link')
  @Permissions(Permission.USE_COUPANG_PARTNERS)
  async createAffiliateLink(@Body() dto: CreateAffiliateLinkDto): Promise<CoupangAffiliateLink> {
    return this.coupangPartnersService.createAffiliateLink(dto.coupangUrl)
  }

  /**
   * API 키 유효성 검증
   */
  @Get('validate-keys')
  @Permissions(Permission.USE_COUPANG_PARTNERS)
  async validateApiKeys(): Promise<{ isValid: boolean }> {
    const isValid = await this.coupangPartnersService.validateApiKeys()
    return { isValid }
  }

  /**
   * 설정 정보 조회
   */
  @Get('config')
  @Permissions(Permission.USE_COUPANG_PARTNERS)
  async getConfig() {
    return this.coupangPartnersService.getConfigInfo()
  }
}
