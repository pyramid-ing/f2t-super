import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { AgodaAffiliateLink } from './agoda-partners.types'

@Injectable()
export class AgodaPartnersService {
  private readonly logger = new Logger(AgodaPartnersService.name)

  constructor(private readonly settingsService: SettingsService) {}

  // 어필리에이트 링크: 파트너 검색 경유 링크 생성 (partnersearch.aspx?cid=...&url=...)
  async createAffiliateLink(originalUrl: string): Promise<AgodaAffiliateLink> {
    const settings = await this.settingsService.getSettings()
    // 우선순위: 설정의 apiKey에서 CID 파싱
    const rawApiKey = settings?.agoda?.apiKey || ''
    const [partnerId] = rawApiKey.split(':')

    // 파트너 ID가 있으면 아고다 파트너 경유 링크로 변환, 없으면 원본 URL 유지
    const finalUrl = partnerId
      ? (() => {
          const partnerUrl = new URL('https://www.agoda.com/partners/partnersearch.aspx')
          partnerUrl.searchParams.set('cid', partnerId)
          partnerUrl.searchParams.set('url', originalUrl)
          return partnerUrl.toString()
        })()
      : originalUrl
    return {
      originalUrl,
      shortenUrl: finalUrl,
    }
  }
}
