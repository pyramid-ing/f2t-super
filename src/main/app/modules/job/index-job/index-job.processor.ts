import { Injectable } from '@nestjs/common'
import { Job } from '@prisma/client'
import { JobProcessor, IndexProvider, IndexStatus } from '@main/app/modules/job/job.types'
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
    let bulkPayload: { type: 'BULK_INDEX'; siteId: number; urls: string[]; provider?: IndexProvider } | null = null
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
    let providerFromDescRaw = (desc.match(/INDEX_PROVIDER=([A-Z]+)/) ||
      desc.match(/provider=([A-Z]+)/) ||
      desc.match(/idx:([A-Z]+)/))?.[1]
    let providerFromDesc: IndexProvider | undefined
    if (providerFromDescRaw && ['GOOGLE', 'BING', 'NAVER', 'DAUM'].includes(providerFromDescRaw)) {
      providerFromDesc = providerFromDescRaw as IndexProvider
    }
    if (!providerFromDesc && bulkPayload?.provider) {
      providerFromDesc = bulkPayload.provider
    }

    // 활성 엔진 계산 (provider 미지정 시)
    const site = await this.prisma.site.findUnique({ where: { id: siteId } })
    const activeProviders: IndexProvider[] = []
    if (site) {
      try {
        const google = JSON.parse(site.googleConfig || '{}')
        const bing = JSON.parse(site.bingConfig || '{}')
        const naver = JSON.parse(site.naverConfig || '{}')
        const daum = JSON.parse(site.daumConfig || '{}')
        if (google?.use) activeProviders.push(IndexProvider.GOOGLE)
        if (bing?.use) activeProviders.push(IndexProvider.BING)
        if (naver?.use) activeProviders.push(IndexProvider.NAVER)
        if (daum?.use) activeProviders.push(IndexProvider.DAUM)
      } catch {}
    }

    const providersToProcess = providerFromDesc ? [providerFromDesc] : activeProviders
    for (const provider of providersToProcess) {
      if (bulkPayload) {
        // 벌크 케이스 처리
        // 재시작 시 실패만 재시작하도록, 우선 대상 URL을 선별한다.
        const existing = await this.prisma.index.findMany({
          where: { siteId, provider, url: { in: bulkPayload.urls } },
        })
        let urlsToSubmit: string[] = []
        if (existing.length === 0) {
          // Index 레코드가 아직 없다면(이상 케이스) 전체 제출
          urlsToSubmit = bulkPayload.urls
        } else {
          // 1) 요청/처리중 우선 처리(최초 실행 포함)
          const pendingOrProcessing = existing
            .filter(i => i.status === IndexStatus.REQUEST || i.status === IndexStatus.PROCESSING)
            .map(i => i.url)
          if (pendingOrProcessing.length > 0) {
            urlsToSubmit = pendingOrProcessing
          } else {
            // 2) 재시작: 실패 건만 재시도
            const failed = existing.filter(i => i.status === IndexStatus.FAILED).map(i => i.url)
            urlsToSubmit = failed
          }
        }
        if (!urlsToSubmit.length) {
          await this.jobLogsService.log(jobId, `${provider} 재시작 대상 URL이 없습니다.`)
          continue
        }
        await this.jobLogsService.log(jobId, `${provider} 벌크 인덱싱 시작: ${urlsToSubmit.length}개`)
        try {
          switch (provider) {
            case IndexProvider.GOOGLE: {
              const res = await this.googleIndexer.submitUrls(siteId, urlsToSubmit, 'URL_UPDATED')
              const summary = res?.data
              const successUrls: string[] = Array.isArray(summary?.successUrls)
                ? summary.successUrls.map((i: any) => i.url)
                : []
              const failedUrls: string[] = Array.isArray(summary?.failedUrls)
                ? summary.failedUrls.map((i: any) => i.url)
                : []
              for (const u of successUrls) {
                await this.prisma.index.updateMany({
                  where: { siteId, provider, url: u },
                  data: { status: IndexStatus.COMPLETED, indexedAt: new Date() },
                })
                await this.jobLogsService.log(jobId, `${provider} 성공: ${u}`)
              }
              for (const u of failedUrls) {
                await this.prisma.index.updateMany({
                  where: { siteId, provider, url: u },
                  data: { status: IndexStatus.FAILED },
                })
                await this.jobLogsService.log(jobId, `${provider} 실패: ${u}`, 'error')
              }
              break
            }
            case IndexProvider.NAVER: {
              const res = await this.naverIndexer.submitUrls(siteId, urlsToSubmit)
              // 결과를 URL별로 Index 상태 반영
              for (const r of res.results) {
                await this.prisma.index.updateMany({
                  where: { siteId, provider, url: r.url },
                  data: { status: r.success ? IndexStatus.COMPLETED : IndexStatus.FAILED, indexedAt: new Date() },
                })
                await this.jobLogsService.log(
                  jobId,
                  `${provider} ${r.success ? '성공' : '실패'}: ${r.url} ${r.message || ''}`,
                )
              }
              break
            }
            case IndexProvider.BING: {
              const res = await this.bingIndexer.submitUrls(siteId, urlsToSubmit)
              for (const r of res.results) {
                await this.prisma.index.updateMany({
                  where: { siteId, provider, url: r.url },
                  data: { status: r.success ? IndexStatus.COMPLETED : IndexStatus.FAILED, indexedAt: new Date() },
                })
                await this.jobLogsService.log(
                  jobId,
                  `${provider} ${r.success ? '성공' : '실패'}: ${r.url} ${r.message || ''}`,
                )
              }
              break
            }
            case IndexProvider.DAUM: {
              const res = await this.daumIndexer.submitUrls(siteId, urlsToSubmit)
              for (const r of res.results) {
                await this.prisma.index.updateMany({
                  where: { siteId, provider, url: r.url },
                  data: { status: r.success ? IndexStatus.COMPLETED : IndexStatus.FAILED, indexedAt: new Date() },
                })
                await this.jobLogsService.log(
                  jobId,
                  `${provider} ${r.success ? '성공' : '실패'}: ${r.url} ${r.message || ''}`,
                )
              }
              break
            }
            default:
              break
          }

          await this.jobLogsService.log(jobId, `${provider} 벌크 인덱싱 완료`)
        } catch (error) {
          await this.prisma.index.updateMany({
            where: { siteId, provider, url: { in: urlsToSubmit } },
            data: { status: IndexStatus.FAILED },
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
        update: { status: IndexStatus.PROCESSING, updatedAt: new Date() },
        create: { url, provider, siteId, status: IndexStatus.PROCESSING, indexedAt: new Date() },
      })
      await this.jobLogsService.log(jobId, `${provider} 인덱싱 시작: ${url}`)
      try {
        switch (provider) {
          case IndexProvider.GOOGLE: {
            await this.googleIndexer.submitUrls(siteId, [url], 'URL_UPDATED')
            break
          }
          case IndexProvider.BING: {
            const res = await this.bingIndexer.submitUrls(siteId, [url])
            for (const r of res.results) {
              await this.prisma.index.updateMany({
                where: { siteId, provider, url: r.url },
                data: { status: r.success ? IndexStatus.COMPLETED : IndexStatus.FAILED, indexedAt: new Date() },
              })
              await this.jobLogsService.log(
                jobId,
                `${provider} ${r.success ? '성공' : '실패'}: ${r.url} ${r.message || ''}`,
              )
            }
            break
          }
          case IndexProvider.NAVER: {
            const res = await this.naverIndexer.submitUrls(siteId, [url])
            for (const r of res.results) {
              await this.prisma.index.updateMany({
                where: { siteId, provider, url: r.url },
                data: { status: r.success ? IndexStatus.COMPLETED : IndexStatus.FAILED, indexedAt: new Date() },
              })
              await this.jobLogsService.log(
                jobId,
                `${provider} ${r.success ? '성공' : '실패'}: ${r.url} ${r.message || ''}`,
              )
            }
            break
          }
          case IndexProvider.DAUM: {
            const res = await this.daumIndexer.submitUrls(siteId, [url])
            for (const r of res.results) {
              await this.prisma.index.updateMany({
                where: { siteId, provider, url: r.url },
                data: { status: r.success ? IndexStatus.COMPLETED : IndexStatus.FAILED, indexedAt: new Date() },
              })
              await this.jobLogsService.log(
                jobId,
                `${provider} ${r.success ? '성공' : '실패'}: ${r.url} ${r.message || ''}`,
              )
            }
            break
          }
          default:
            break
        }
        await this.prisma.index.update({
          where: { id: indexRecord.id },
          data: { status: IndexStatus.COMPLETED, indexedAt: new Date() },
        })
        await this.jobLogsService.log(jobId, `${provider} 인덱싱 성공: ${url}`)
      } catch (error) {
        await this.prisma.index.update({ where: { id: indexRecord.id }, data: { status: IndexStatus.FAILED } })
        await this.jobLogsService.log(jobId, `${provider} 인덱싱 실패: ${error?.message || 'unknown error'}`, 'error')
      }
    }
  }
}
