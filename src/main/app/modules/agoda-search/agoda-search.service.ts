import { Injectable } from '@nestjs/common'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { AgodaSearchClient } from './agoda-search.client'
import { AgodaSearchRequestBody, AgodaSearchResponse } from './agoda-search.types'

@Injectable()
export class AgodaSearchService {
  private client: AgodaSearchClient

  constructor(private readonly settingsService: SettingsService) {
    // 환경변수 기본값 + 필요 시 Settings 에서 오버라이드 가능
    this.client = new AgodaSearchClient(this.settingsService)
  }

  async search(body: AgodaSearchRequestBody): Promise<AgodaSearchResponse> {
    return await this.client.search(body)
  }
}
