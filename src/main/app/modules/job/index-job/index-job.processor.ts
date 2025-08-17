import { Injectable } from '@nestjs/common'
import { Job } from '@prisma/client'
import { JobProcessor } from '@main/app/modules/job/job.types'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { GoogleIndexerService } from '@main/app/modules/google/indexer/google-indexer.service'
import { BingIndexerService } from '@main/app/modules/bing-indexer/bing-indexer.service'
import { NaverIndexerService } from '@main/app/modules/naver-indexer/naver-indexer.service'
import { DaumIndexerService } from '@main/app/modules/daum-indexer/daum-indexer.service'
import { JobLogsService } from '@main/app/modules/job/job-logs/job-logs.service'

@Injectable()
export class IndexJobProcessor implements JobProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleIndexer: GoogleIndexerService,
    private readonly bingIndexer: BingIndexerService,
    private readonly naverIndexer: NaverIndexerService,
    private readonly daumIndexer: DaumIndexerService,
    private readonly jobLogsService: JobLogsService,
  ) {}

  canProcess(job: Job): boolean {
    return job.targetType === 'index'
  }

  async process(jobId: string): Promise<void> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!job) return

    const subject = job.subject || ''
    const desc = job.desc || ''

    // desc에 BULK_INDEX 포맷이 포함되어 있는지 먼저 확인
    let bulkPayload: { type: 'BULK_INDEX'; siteId: number; urls: string[]; provider?: string } | null = null
    try {
      const parsed = JSON.parse(desc)
      if (parsed && parsed.type === 'BULK_INDEX' && Array.isArray(parsed.urls) && parsed.siteId) {
        bulkPayload = parsed
      }
    } catch {}

    // 단건 모드에서만 URL 파싱 필요
    let url: string | undefined
    if (!bulkPayload) {
      const subjectMatch = subject.match(/https?:\/\/\S+/)
      if (subjectMatch) {
        url = subjectMatch[0]
      }
      if (!url) return
    }

    // siteId 결정: 벌크면 desc에서, 아니면 url에서 도출
    let siteId: number | undefined
    if (bulkPayload) {
      siteId = bulkPayload.siteId
    } else if (url) {
      try {
        const u = new URL(url)
        const domain = u.hostname.replace(/^www\./, '')
        const site = await this.prisma.site.findUnique({ where: { domain } })
        siteId = site?.id
      } catch {}
    }
    if (!siteId) return

    // provider 힌트 파싱 (옵션)
    let providerFromDesc = (desc.match(/INDEX_PROVIDER=([A-Z]+)/) ||
      desc.match(/provider=([A-Z]+)/) ||
      desc.match(/idx:([A-Z]+)/))?.[1]
    if (!providerFromDesc && bulkPayload?.provider) {
      providerFromDesc = bulkPayload.provider
    }

    // 활성 엔진 계산 (provider 미지정 시)
    const site = await this.prisma.site.findUnique({ where: { id: siteId } })
    const activeProviders: string[] = []
    if (site) {
      try {
        const google = JSON.parse(site.googleConfig || '{}')
        const bing = JSON.parse(site.bingConfig || '{}')
        const naver = JSON.parse(site.naverConfig || '{}')
        const daum = JSON.parse(site.daumConfig || '{}')
        if (google?.use) activeProviders.push('GOOGLE')
        if (bing?.use) activeProviders.push('BING')
        if (naver?.use) activeProviders.push('NAVER')
        if (daum?.use) activeProviders.push('DAUM')
      } catch {}
    }

    const providersToProcess = providerFromDesc ? [providerFromDesc] : activeProviders
    for (const provider of providersToProcess) {
      if (bulkPayload) {
        // 벌크 케이스 처리
        await this.jobLogsService.log(jobId, `${provider} 벌크 인덱싱 시작: ${bulkPayload.urls.length}개`)
        try {
          switch (provider) {
            case 'GOOGLE':
              await this.googleIndexer.batchIndexUrls(siteId, bulkPayload.urls, 'URL_UPDATED')
              break
            case 'NAVER':
              await this.naverIndexer.submitUrls(siteId, bulkPayload.urls)
              break
            case 'BING':
              for (const targetUrl of bulkPayload.urls) {
                await this.bingIndexer.submitUrl(siteId, targetUrl, jobId)
              }
              break
            case 'DAUM':
              for (const targetUrl of bulkPayload.urls) {
                await this.daumIndexer.submitUrl(siteId, targetUrl)
              }
              break
            default:
              break
          }

          await this.prisma.index.updateMany({
            where: { siteId, provider, url: { in: bulkPayload.urls } },
            data: { status: 'completed', indexedAt: new Date() },
          })
          await this.jobLogsService.log(jobId, `${provider} 벌크 인덱싱 완료`)
        } catch (error) {
          await this.prisma.index.updateMany({
            where: { siteId, provider, url: { in: bulkPayload.urls } },
            data: { status: 'failed' },
          })
          await this.jobLogsService.log(
            jobId,
            `${provider} 벌크 인덱싱 실패: ${error?.message || 'unknown error'}`,
            'error',
          )
        }
        continue
      }

      // 단건 케이스 처리
      const indexRecord = await this.prisma.index.upsert({
        where: { url_provider: { url, provider } },
        update: { status: 'processing', updatedAt: new Date() },
        create: { url, provider, siteId, status: 'processing', indexedAt: new Date() },
      })
      await this.jobLogsService.log(jobId, `${provider} 인덱싱 시작: ${url}`)
      try {
        switch (provider) {
          case 'GOOGLE':
            await this.googleIndexer.submitUrl(siteId, url, jobId)
            break
          case 'BING':
            await this.bingIndexer.submitUrl(siteId, url, jobId)
            break
          case 'NAVER':
            await this.naverIndexer.submitUrl(siteId, url)
            break
          case 'DAUM':
            await this.daumIndexer.submitUrl(siteId, url)
            break
          default:
            break
        }
        await this.prisma.index.update({
          where: { id: indexRecord.id },
          data: { status: 'completed', indexedAt: new Date() },
        })
        await this.jobLogsService.log(jobId, `${provider} 인덱싱 성공: ${url}`)
      } catch (error) {
        await this.prisma.index.update({ where: { id: indexRecord.id }, data: { status: 'failed' } })
        await this.jobLogsService.log(jobId, `${provider} 인덱싱 실패: ${error?.message || 'unknown error'}`, 'error')
      }
    }
  }
}
