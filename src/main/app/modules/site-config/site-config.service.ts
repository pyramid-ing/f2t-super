import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { extractDomain, normalizeSiteUrl, extractProtocolAndDomain } from '@main/app/utils/url.util'

// 검색엔진별 설정 인터페이스
export interface GoogleSiteConfig {
  use: boolean
  serviceAccountJson: string
}

export interface BingSiteConfig {
  use: boolean
  apiKey: string
}

export interface NaverSiteConfig {
  use: boolean
  selectedNaverAccountId?: number // NaverAccount 테이블의 ID를 참조
}

export interface DaumSiteConfig {
  use: boolean
  siteUrl: string
  password: string // PIN 코드
}

export interface SiteConfigData {
  id?: number
  domain: string
  name: string
  siteUrl: string
  isActive?: boolean
  googleConfig?: GoogleSiteConfig
  naverConfig?: NaverSiteConfig
  daumConfig?: DaumSiteConfig
  bingConfig?: BingSiteConfig
  createdAt?: Date
  updatedAt?: Date
}

export interface EngineConfig {
  google?: GoogleSiteConfig
  naver?: NaverSiteConfig
  daum?: DaumSiteConfig
  bing?: BingSiteConfig
}

@Injectable()
export class SiteConfigService {
  constructor(private readonly prisma: PrismaService) {}

  public async createSiteConfig(data: SiteConfigData) {
    const normalizedSiteUrl = normalizeSiteUrl(data.siteUrl)
    const domain = extractDomain(normalizedSiteUrl)

    try {
      return await this.prisma.site.create({
        data: {
          domain,
          name: data.name,
          siteUrl: normalizedSiteUrl,
          isActive: data.isActive ?? true,
          googleConfig: JSON.stringify(data.googleConfig || {}),
          naverConfig: JSON.stringify(data.naverConfig || {}),
          daumConfig: JSON.stringify(data.daumConfig || {}),
          bingConfig: JSON.stringify(data.bingConfig || {}),
        },
      })
    } catch (error) {
      if (error.code === 'P2002') {
        // 기존 사이트 정보 조회하여 더 상세한 에러 메시지 제공
        const existingSite = await this.prisma.site.findFirst({
          where: { domain },
        })

        throw new CustomHttpException(ErrorCode.SITE_DOMAIN_DUPLICATE, {
          message: `이미 등록된 도메인입니다: ${domain}`,
          details: {
            existingSiteName: existingSite?.name,
            existingSiteId: existingSite?.id,
            domain,
          },
        })
      }
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, { errorMessage: error.message })
    }
  }

  public async getSiteConfig(siteId: number): Promise<SiteConfigData> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    })

    if (!site) {
      throw new CustomHttpException(ErrorCode.SITE_NOT_FOUND, { siteId })
    }

    return {
      id: site.id,
      domain: site.domain,
      name: site.name,
      siteUrl: site.siteUrl,
      isActive: site.isActive,
      googleConfig: JSON.parse(site.googleConfig),
      naverConfig: JSON.parse(site.naverConfig),
      daumConfig: JSON.parse(site.daumConfig),
      bingConfig: JSON.parse(site.bingConfig),
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    }
  }

  public async getSiteConfigByDomain(domain: string) {
    const site = await this.prisma.site.findUnique({
      where: { domain },
    })

    if (!site) {
      throw new CustomHttpException(ErrorCode.SITE_NOT_FOUND, { domain })
    }

    return {
      id: site.id,
      domain: site.domain,
      name: site.name,
      siteUrl: site.siteUrl,
      isActive: site.isActive,
      googleConfig: JSON.parse(site.googleConfig),
      naverConfig: JSON.parse(site.naverConfig),
      daumConfig: JSON.parse(site.daumConfig),
      bingConfig: JSON.parse(site.bingConfig),
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    }
  }

  public async updateSiteConfig(siteId: number, updates: Partial<SiteConfigData>) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    })

    if (!site) {
      throw new CustomHttpException(ErrorCode.SITE_NOT_FOUND, { siteId })
    }

    const updateData: any = {}

    if (updates.name) updateData.name = updates.name
    if (updates.siteUrl) {
      const normalizedSiteUrl = normalizeSiteUrl(updates.siteUrl)
      const newDomain = extractDomain(normalizedSiteUrl)

      // 도메인 중복 체크 (자신 제외)
      if (newDomain !== site.domain) {
        const existingSite = await this.prisma.site.findFirst({
          where: {
            domain: newDomain,
            id: { not: siteId },
          },
        })

        if (existingSite) {
          throw new CustomHttpException(ErrorCode.SITE_DOMAIN_DUPLICATE, {
            message: `이미 등록된 도메인입니다: ${newDomain}`,
            details: {
              existingSiteName: existingSite.name,
              existingSiteId: existingSite.id,
              domain: newDomain,
            },
          })
        }
      }

      updateData.siteUrl = normalizedSiteUrl
      updateData.domain = newDomain
    }
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive
    if (updates.googleConfig) updateData.googleConfig = JSON.stringify(updates.googleConfig)
    if (updates.naverConfig) updateData.naverConfig = JSON.stringify(updates.naverConfig)
    if (updates.daumConfig) updateData.daumConfig = JSON.stringify(updates.daumConfig)
    if (updates.bingConfig) updateData.bingConfig = JSON.stringify(updates.bingConfig)

    return this.prisma.site.update({
      where: { id: siteId },
      data: updateData,
    })
  }

  public async updateSiteEngineConfigs(siteId: number, configs: EngineConfig) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    })

    if (!site) {
      throw new CustomHttpException(ErrorCode.SITE_NOT_FOUND, { siteId })
    }

    const updateData: any = {}

    if (configs.google) updateData.googleConfig = JSON.stringify(configs.google)
    if (configs.naver) updateData.naverConfig = JSON.stringify(configs.naver)
    if (configs.daum) updateData.daumConfig = JSON.stringify(configs.daum)
    if (configs.bing) updateData.bingConfig = JSON.stringify(configs.bing)

    return this.prisma.site.update({
      where: { id: siteId },
      data: updateData,
    })
  }

  public async deleteSiteConfig(siteId: number) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    })

    if (!site) {
      throw new CustomHttpException(ErrorCode.SITE_NOT_FOUND, { siteId })
    }

    try {
      await this.prisma.$transaction([
        // 자식 테이블부터 삭제하여 FK 제약 위반 방지
        this.prisma.index.deleteMany({ where: { siteId } }),
        this.prisma.sitemapConfig.deleteMany({ where: { siteId } }),
        this.prisma.site.delete({ where: { id: siteId } }),
      ])
    } catch (error) {
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, { errorMessage: error.message })
    }

    return { message: '사이트 설정이 삭제되었습니다.' }
  }

  public async getAllSiteConfigs() {
    const sites = await this.prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return sites.map((site: any) => ({
      id: site.id,
      domain: site.domain,
      name: site.name,
      siteUrl: site.siteUrl,
      isActive: site.isActive,
      googleConfig: JSON.parse(site.googleConfig),
      naverConfig: JSON.parse(site.naverConfig),
      daumConfig: JSON.parse(site.daumConfig),
      bingConfig: JSON.parse(site.bingConfig),
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    }))
  }

  public async getActiveSites() {
    const sites = await this.prisma.site.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    return sites.map((site: any) => ({
      id: site.id,
      domain: site.domain,
      name: site.name,
      siteUrl: site.siteUrl,
      isActive: site.isActive,
      googleConfig: JSON.parse(site.googleConfig),
      naverConfig: JSON.parse(site.naverConfig),
      daumConfig: JSON.parse(site.daumConfig),
      bingConfig: JSON.parse(site.bingConfig),
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    }))
  }

  /**
   * 인덱싱할 URL이 사이트의 도메인과 일치하는지 검증합니다.
   * 프로토콜과 도메인을 모두 비교합니다.
   */
  public async validateUrlDomain(siteId: number, urlToIndex: string): Promise<void> {
    const siteConfig = await this.getSiteConfig(siteId)

    if (!siteConfig) {
      throw new CustomHttpException(ErrorCode.SITE_NOT_FOUND, { siteId })
    }

    const urlDomain = extractProtocolAndDomain(urlToIndex)
    const siteDomain = extractProtocolAndDomain(siteConfig.siteUrl)

    if (urlDomain !== siteDomain) {
      throw new CustomHttpException(ErrorCode.SITE_DOMAIN_MISMATCH, { urlDomain, siteDomain })
    }
  }

  /**
   * 사이트 존재 여부를 검증합니다.
   */
  public async validateSiteExists(siteId: number): Promise<SiteConfigData> {
    const siteConfig = await this.getSiteConfig(siteId)

    if (!siteConfig) {
      throw new CustomHttpException(ErrorCode.SITE_NOT_FOUND, { siteId })
    }

    if (!siteConfig.isActive) {
      throw new CustomHttpException(ErrorCode.SITE_INACTIVE, { siteId })
    }

    return siteConfig
  }
}
