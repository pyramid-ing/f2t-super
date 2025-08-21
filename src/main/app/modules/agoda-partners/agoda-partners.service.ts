import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { AgodaAffiliateLink } from './agoda-partners.types'

@Injectable()
export class AgodaPartnersService {
  private readonly logger = new Logger(AgodaPartnersService.name)

  constructor(private readonly settingsService: SettingsService) {}

  // 간단 어필리에이트 링크: 원본 URL에 파라미터 부착만 수행
  async createAffiliateLink(originalUrl: string): Promise<AgodaAffiliateLink> {
    const settings = await this.settingsService.getSettings()
    // 우선순위: 설정의 apiKey에서 CID 파싱
    const rawApiKey = settings?.agoda?.apiKey || ''
    const [partnerId] = rawApiKey.split(':')

    // 기본: ?cid=partnerId 형태. 이미 쿼리가 있으면 &cid=
    const url = new URL(originalUrl)
    if (!url.searchParams.has('cid') && partnerId) {
      url.searchParams.set('cid', partnerId)
    }

    const finalUrl = url.toString()
    return {
      originalUrl,
      shortenUrl: finalUrl,
    }
  }
}
