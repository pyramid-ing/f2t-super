import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobStatus, JobTargetType } from '@main/app/modules/job/job.types'
import { JOB_STATUS } from '@render/api'

@Injectable()
export class IndexJobService {
  constructor(private readonly prisma: PrismaService) {}

  static normalizeUrl(rawUrl: string): string {
    try {
      const urlObj = new URL(rawUrl)
      let protocol = urlObj.protocol.replace(/:$/, '')
      let host = urlObj.host
      let pathname = urlObj.pathname.replace(/\/$/, '')
      if (pathname === '') pathname = '/'
      return `${protocol}://${host}${pathname}${urlObj.search}`
    } catch {
      return rawUrl.trim()
    }
  }

  async createBulk({
    urls,
  }: {
    urls: string[]
  }): Promise<{ success: boolean; message: string; createdJobCount?: number; createdIndexCount?: number }> {
    // 입력 정제
    const validUrls = (urls || []).map(u => u?.trim()).filter(Boolean)
    if (validUrls.length === 0) return { success: false, message: 'URL이 없습니다.' }

    // 사이트별로 URL 그룹핑
    const siteToUrlsMap = new Map<number, { siteDomain: string; urls: string[] }>()
    for (const rawUrl of validUrls) {
      try {
        const u = new URL(rawUrl)
        const domain = u.hostname.replace(/^www\./, '')
        const site = await this.prisma.site.findUnique({ where: { domain } })
        if (!site) continue
        const normalizedUrl = IndexJobService.normalizeUrl(rawUrl)
        const current = siteToUrlsMap.get(site.id) || { siteDomain: site.domain, urls: [] }
        current.urls.push(normalizedUrl)
        siteToUrlsMap.set(site.id, current)
      } catch {
        // skip invalid url
      }
    }

    if (siteToUrlsMap.size === 0) return { success: false, message: '처리 가능한 URL이 없습니다.' }

    let createdJobCount = 0
    let createdIndexCount = 0

    for (const [siteId, { siteDomain, urls: siteUrls }] of siteToUrlsMap.entries()) {
      const site = await this.prisma.site.findUnique({ where: { id: siteId } })
      if (!site) continue

      // 활성화된 검색 엔진 계산
      const google = JSON.parse(site.googleConfig || '{}')
      const bing = JSON.parse(site.bingConfig || '{}')
      const naver = JSON.parse(site.naverConfig || '{}')
      const daum = JSON.parse(site.daumConfig || '{}')
      const activeEngines: string[] = []
      if (google?.use) activeEngines.push('GOOGLE')
      if (bing?.use) activeEngines.push('BING')
      if (naver?.use) activeEngines.push('NAVER')
      if (daum?.use) activeEngines.push('DAUM')
      if (activeEngines.length === 0) continue

      // 이미 존재하는 Index 제거 후 신규 대상 산출
      const existing = await this.prisma.index.findMany({
        where: { siteId, url: { in: siteUrls }, provider: { in: activeEngines } },
      })

      const tasksByProvider: Record<string, string[]> = {}
      for (const provider of activeEngines) {
        const toIndex = siteUrls.filter(
          url => !existing.find(e => e.url === url && e.provider.toUpperCase() === provider),
        )
        if (toIndex.length > 0) tasksByProvider[provider] = toIndex
      }

      // 신규가 하나도 없으면 건너뜀
      const totalNew = Object.values(tasksByProvider).reduce((acc, arr) => acc + arr.length, 0)
      if (totalNew === 0) continue

      // Index 레코드 벌크 upsert (status=request)
      const upserts = [] as any[]
      for (const [provider, list] of Object.entries(tasksByProvider)) {
        for (const url of list) {
          upserts.push(
            this.prisma.index.upsert({
              where: { url_provider: { url, provider } },
              update: {},
              create: { url, provider, siteId, status: 'request', indexedAt: new Date() },
            }),
          )
        }
      }
      if (upserts.length > 0) {
        await this.prisma.$transaction(upserts)
        createdIndexCount += upserts.length
      }

      // 사이트당 1개의 Job + IndexJob 생성 (desc에 사이트와 URL 목록만 포함)
      const job = await this.prisma.job.create({
        data: {
          targetType: JobTargetType.INDEX,
          status: JobStatus.REQUEST,
          subject: `인덱싱 요청(벌크): ${siteDomain}`,
          desc: JSON.stringify({ type: 'BULK_INDEX', siteId, urls: siteUrls }),
          scheduledAt: new Date(),
          priority: 1,
        },
      })

      await this.prisma.indexJob.create({
        data: {
          jobId: job.id,
        },
      })
      createdJobCount += 1
    }

    if (createdJobCount === 0 || createdIndexCount === 0) {
      return {
        success: false,
        message: '모든 URL이 이미 인덱싱되어 새로운 작업이 생성되지 않았습니다.',
        createdJobCount,
        createdIndexCount,
      }
    }

    return {
      success: true,
      message: `${createdJobCount}개 사이트에서 ${createdIndexCount}개 URL 인덱싱 작업이 생성되었습니다.`,
      createdJobCount,
      createdIndexCount,
    }
  }

  async getStatusByUrl(url: string) {
    let domain: string
    try {
      const u = new URL(url)
      domain = u.hostname.replace(/^www\./, '')
    } catch {
      return {}
    }
    const site = await this.prisma.site.findUnique({ where: { domain } })
    if (!site) return {}
    const normalizedUrl = IndexJobService.normalizeUrl(url)
    const indexes = await this.prisma.index.findMany({
      where: { siteId: site.id, url: normalizedUrl },
    })
    const statusMap: Record<string, string> = {}
    for (const idx of indexes) {
      statusMap[idx.provider.toUpperCase()] = idx.status || JOB_STATUS.REQUEST
    }
    return statusMap
  }
}
