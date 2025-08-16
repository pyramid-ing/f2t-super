import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { BingIndexerService } from '@main/app/modules/bing-indexer/bing-indexer.service'
import { GoogleIndexerService } from '@main/app/modules/google/indexer/google-indexer.service'
import { NaverIndexerService } from '@main/app/modules/naver-indexer/naver-indexer.service'
import { DaumIndexerService } from '@main/app/modules/daum-indexer/daum-indexer.service'
import { JobStatus } from '@main/app/modules/job/job.types'

@Injectable()
export class IndexJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bingIndexer: BingIndexerService,
    private readonly googleIndexer: GoogleIndexerService,
    private readonly naverIndexer: NaverIndexerService,
    private readonly daumIndexer: DaumIndexerService,
  ) {}

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

  async create({ url }: { url: string }): Promise<{ success: boolean; message: string; resultUrl?: string }> {
    // 1) URL에서 도메인 추출로 Site 찾기
    let domain: string
    try {
      const u = new URL(url)
      domain = u.hostname.replace(/^www\./, '')
    } catch {
      return { success: false, message: '유효하지 않은 URL입니다.' }
    }
    const site = await this.prisma.site.findUnique({ where: { domain } })
    if (!site) {
      return { success: false, message: `도메인 '${domain}'에 해당하는 사이트를 찾을 수 없습니다.` }
    }

    const normalizedUrl = IndexJobService.normalizeUrl(url)
    const google = JSON.parse(site.googleConfig || '{}')
    const bing = JSON.parse(site.bingConfig || '{}')
    const naver = JSON.parse(site.naverConfig || '{}')
    const daum = JSON.parse(site.daumConfig || '{}')
    const activeEngines: string[] = []
    if (google?.use) activeEngines.push('GOOGLE')
    if (bing?.use) activeEngines.push('BING')
    if (naver?.use) activeEngines.push('NAVER')
    if (daum?.use) activeEngines.push('DAUM')
    if (activeEngines.length === 0) return { success: false, message: '활성화된 검색엔진이 없습니다.' }

    // 기존 등록된 URL 확인
    const existing = await this.prisma.indexJob.findMany({
      where: { siteId: site.id, url: normalizedUrl, provider: { in: activeEngines } },
    })
    const toCreate = activeEngines.filter(p => !existing.find(e => e.provider === p))
    if (toCreate.length === 0) {
      return { success: false, message: '이미 모든 엔진에 인덱싱 요청됨', resultUrl: normalizedUrl }
    }

    // 작업 생성
    await Promise.all(
      toCreate.map(async provider => {
        await this.prisma.job.create({
          data: {
            targetType: 'index',
            status: JobStatus.PENDING,
            subject: `인덱싱 요청: ${normalizedUrl}`,
            desc: '자동 생성된 인덱싱 작업',
            scheduledAt: new Date(),
            priority: 1,
            IndexJob: {
              create: { siteId: site.id, provider, url: normalizedUrl },
            },
          },
        })
      }),
    )

    return { success: true, message: `${toCreate.length}개 엔진에 인덱싱 작업 생성`, resultUrl: normalizedUrl }
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
    const indexJobs = await this.prisma.indexJob.findMany({
      where: { siteId: site.id, url: normalizedUrl },
      include: { job: true },
    })
    const statusMap: Record<string, string> = {}
    for (const ij of indexJobs) {
      statusMap[ij.provider.toUpperCase()] = ij.job?.status || 'pending'
    }
    return statusMap
  }
}
