import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobStatus, JobTargetType, IndexProvider, IndexStatus } from '@main/app/modules/job/job.types'
import { JOB_STATUS } from '@render/api'
import { normalizeUrl, normalizeSiteUrl } from '@main/app/utils/url.util'

@Injectable()
export class IndexJobService {
  constructor(private readonly prisma: PrismaService) {}

  async createBulk({
    urls,
  }: {
    urls: string[]
  }): Promise<{ success: boolean; message: string; createdJobCount?: number; createdIndexCount?: number }> {
    // 입력 정제
    const validUrls = (urls || []).map(u => u?.trim()).filter(Boolean)
    if (validUrls.length === 0) return { success: false, message: 'URL이 없습니다.' }

    // 사이트 존재 여부 선검사 (프로토콜 + 도메인으로 검색)
    const candidateSites = Array.from(
      new Set(
        validUrls.flatMap(u => {
          try {
            return [normalizeSiteUrl(u)] // 정규화된 사이트 URL
          } catch {
            return []
          }
        }),
      ),
    )
    if (candidateSites.length === 0) return { success: false, message: '처리 가능한 URL이 없습니다.' }
    const existingSites = await this.prisma.site.findMany({ where: { siteUrl: { in: candidateSites } } })
    if (existingSites.length === 0)
      return {
        success: false,
        message: `등록된 사이트가 없습니다. http/https 까지도 확인해야합니다. 입력:${JSON.stringify(candidateSites)}`,
      }

    // 사이트별로 URL 그룹핑
    const siteToUrlsMap = new Map<number, { siteDomain: string; urls: string[] }>()
    for (const rawUrl of validUrls) {
      try {
        const siteKey = normalizeSiteUrl(rawUrl) // 정규화된 사이트 URL
        const site = await this.prisma.site.findFirst({ where: { siteUrl: siteKey } })
        if (!site) continue
        const normalizedUrl = normalizeUrl(rawUrl)
        const current = siteToUrlsMap.get(site.id) || { siteDomain: site.siteUrl, urls: [] }
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
      const activeEngines: IndexProvider[] = []
      if (google?.use) activeEngines.push(IndexProvider.GOOGLE)
      if (bing?.use) activeEngines.push(IndexProvider.BING)
      if (naver?.use) activeEngines.push(IndexProvider.NAVER)
      if (daum?.use) activeEngines.push(IndexProvider.DAUM)
      if (activeEngines.length === 0) continue

      // 기존 Index 조회 (상태 포함)
      const existing = await this.prisma.index.findMany({
        where: { siteId, url: { in: siteUrls }, provider: { in: activeEngines } },
      })

      // 프로바이더별 생성/재시도 대상 산출
      const createTasksByProvider: Record<IndexProvider, string[]> = {} as any
      const retryTasksByProvider: Record<IndexProvider, string[]> = {} as any
      for (const provider of activeEngines) {
        const toCreate = siteUrls.filter(
          url => !existing.find(e => e.url === url && e.provider.toUpperCase() === provider),
        )
        const toRetry = siteUrls.filter(url => {
          const found = existing.find(e => e.url === url && e.provider.toUpperCase() === provider)
          return Boolean(found && found.status === IndexStatus.FAILED)
        })
        if (toCreate.length > 0) createTasksByProvider[provider] = toCreate
        if (toRetry.length > 0) retryTasksByProvider[provider] = toRetry
      }

      // 생성/재시도 대상이 하나도 없으면 건너뜀
      const totalTargets =
        Object.values(createTasksByProvider).reduce((acc, arr) => acc + arr.length, 0) +
        Object.values(retryTasksByProvider).reduce((acc, arr) => acc + arr.length, 0)
      if (totalTargets === 0) continue

      // Index 레코드 벌크 처리 (신규 생성 + 실패건 재요청)
      const ops = [] as any[]
      for (const [provider, list] of Object.entries(createTasksByProvider)) {
        for (const url of list) {
          ops.push(
            this.prisma.index.create({
              data: { url, provider, siteId, status: IndexStatus.REQUEST, indexedAt: new Date() },
            }),
          )
        }
      }
      for (const [provider, list] of Object.entries(retryTasksByProvider)) {
        for (const url of list) {
          ops.push(
            this.prisma.index.updateMany({
              where: { siteId, provider: provider as IndexProvider, url, status: IndexStatus.FAILED },
              data: { status: IndexStatus.REQUEST, indexedAt: new Date() },
            }),
          )
        }
      }
      if (ops.length > 0) {
        await this.prisma.$transaction(ops)
        createdIndexCount += ops.length
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
    const siteKey = normalizeSiteUrl(url) // 정규화된 사이트 URL
    const site = await this.prisma.site.findFirst({ where: { siteUrl: siteKey } })
    if (!site) return {}
    const normalizedUrl = normalizeUrl(url)
    const indexes = await this.prisma.index.findMany({
      where: { siteId: site.id, url: normalizedUrl },
    })
    const statusMap: Record<string, string> = {}
    for (const idx of indexes) {
      statusMap[idx.provider.toUpperCase()] = idx.status || JOB_STATUS.REQUEST
    }
    return statusMap
  }

  async getDetailsByUrl(
    url: string,
  ): Promise<{ provider: IndexProvider; status: string; indexedAt?: string; updatedAt: string }[]> {
    const siteKey = normalizeSiteUrl(url) // 정규화된 사이트 URL
    const site = await this.prisma.site.findFirst({ where: { siteUrl: siteKey } })
    if (!site) return []
    const normalizedUrl = normalizeUrl(url)
    const indexes = await this.prisma.index.findMany({
      where: { siteId: site.id, url: normalizedUrl },
      orderBy: { updatedAt: 'desc' },
    })
    return indexes.map(i => ({
      provider: i.provider.toUpperCase() as IndexProvider,
      status: i.status,
      indexedAt: i.indexedAt ? new Date(i.indexedAt).toISOString() : undefined,
      updatedAt: new Date(i.updatedAt).toISOString(),
    }))
  }

  async listIndexes({
    q,
    status,
    provider,
    page = 1,
    pageSize = 20,
  }: {
    q?: string
    status?: IndexStatus
    provider?: IndexProvider
    page?: number
    pageSize?: number
  }) {
    const where: any = {}
    if (q && q.trim()) {
      where.url = { contains: q.trim() }
    }
    if (status) where.status = status
    if (provider) where.provider = provider

    const total = await this.prisma.index.count({ where })
    const items = await this.prisma.index.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      total,
      page,
      pageSize,
      items: items.map(i => ({
        id: i.id,
        url: i.url,
        provider: i.provider.toUpperCase() as IndexProvider,
        status: i.status,
        errorMsg: i.errorMsg || null,
        indexedAt: i.indexedAt ? new Date(i.indexedAt).toISOString() : undefined,
        updatedAt: new Date(i.updatedAt).toISOString(),
      })),
    }
  }

  async listIndexesByJobId({
    jobId,
    q,
    status,
    provider,
    page = 1,
    pageSize = 50,
  }: {
    jobId: string
    q?: string
    status?: IndexStatus
    provider?: IndexProvider
    page?: number
    pageSize?: number
  }) {
    // jobId -> IndexJob -> Job.desc(JSON)에서 BULK_INDEX payload의 urls와 siteId 추출 후 해당 Index만 조회
    const indexJob = await this.prisma.indexJob.findUnique({ where: { jobId } })
    if (!indexJob) {
      return { total: 0, page, pageSize, items: [] }
    }
    const job = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!job?.desc) {
      return { total: 0, page, pageSize, items: [] }
    }
    let payload: any
    try {
      payload = JSON.parse(job.desc)
    } catch {
      payload = null
    }
    if (!payload || payload.type !== 'BULK_INDEX' || !Array.isArray(payload.urls) || !payload.siteId) {
      return { total: 0, page, pageSize, items: [] }
    }
    const normalizedUrls = (payload.urls as string[])
      .map(u => {
        try {
          return normalizeUrl(u)
        } catch {
          return ''
        }
      })
      .filter(Boolean)

    const where: any = {
      siteId: payload.siteId,
      url: { in: normalizedUrls },
    }

    // 추가 필터 적용
    if (q && q.trim()) {
      where.url = {
        in: normalizedUrls,
        contains: q.trim(),
      }
    }
    if (status) where.status = status
    if (provider) where.provider = provider

    const total = await this.prisma.index.count({ where })
    const items = await this.prisma.index.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      total,
      page,
      pageSize,
      items: items.map(i => ({
        id: i.id,
        url: i.url,
        provider: i.provider.toUpperCase() as IndexProvider,
        status: i.status,
        errorMsg: i.errorMsg || null,
        indexedAt: i.indexedAt ? new Date(i.indexedAt).toISOString() : undefined,
        updatedAt: new Date(i.updatedAt).toISOString(),
      })),
    }
  }
}
