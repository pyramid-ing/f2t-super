import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../common/prisma/prisma.service'
import * as xml2js from 'xml2js'
import axios from 'axios'
import {
  SitemapUrl,
  IndexingConfig,
  SitemapProcessor,
  EngineConfig,
  SitemapItem,
  UrlItem,
  XmlData,
} from './sitemap.types'
import { IndexJobService } from '@main/app/modules/job/index-job/index-job.service'

// 통합 사이트맵 처리기 (모든 플랫폼 지원)
class DefaultSitemapProcessor implements SitemapProcessor {
  private readonly logger = new Logger(DefaultSitemapProcessor.name)

  canProcess(sitemapType: string): boolean {
    return ['blogspot', 'tistory', 'wordpress', 'custom'].includes(sitemapType)
  }

  async processSitemap(
    xmlText: string,
    baseUrl: string,
    indexingConfig?: IndexingConfig,
    processedSitemapUrls?: Set<string>,
  ): Promise<SitemapUrl[]> {
    const parser = new xml2js.Parser({
      explicitArray: false,
    })
    const data = await parser.parseStringPromise(xmlText)

    // 처리된 URL 추적 Set 초기화
    const processedUrls = processedSitemapUrls || new Set<string>()

    // XML 구조 분석 및 처리
    return this.processXmlData(data, baseUrl, indexingConfig, processedUrls)
  }

  /**
   * XML 데이터를 분석하여 적절한 처리기로 라우팅
   */
  private async processXmlData(
    data: XmlData,
    baseUrl: string,
    indexingConfig?: IndexingConfig,
    processedSitemapUrls?: Set<string>,
  ): Promise<SitemapUrl[]> {
    const urls: SitemapUrl[] = []
    const processedUrls = processedSitemapUrls || new Set<string>()

    // XML 구조 로깅
    this.logger.log(`XML 구조 분석: ${Object.keys(data).join(', ')}`)
    this.logger.log(`Base URL: ${baseUrl}`)

    // 1. sitemapindex 처리 (재귀)
    if (this.isSitemapIndex(data)) {
      this.logger.log('SitemapIndex 감지 - 재귀 처리 시작')

      // 다양한 네임스페이스에서 sitemap 배열 추출
      let sitemapArray: SitemapItem[] = []
      if (data.sitemapindex && data.sitemapindex.sitemap) {
        sitemapArray = Array.isArray(data.sitemapindex.sitemap)
          ? data.sitemapindex.sitemap
          : [data.sitemapindex.sitemap]
        this.logger.log('표준 sitemapindex 구조 사용')
      } else if (data['sitemap:sitemapindex'] && data['sitemap:sitemapindex']['sitemap:sitemap']) {
        sitemapArray = Array.isArray(data['sitemap:sitemapindex']['sitemap:sitemap'])
          ? data['sitemap:sitemapindex']['sitemap:sitemap']
          : [data['sitemap:sitemapindex']['sitemap:sitemap']]
        this.logger.log('네임스페이스 sitemapindex 구조 사용')
      }

      this.logger.log(`하위 sitemap 개수: ${sitemapArray.length}`)

      for (const sitemap of sitemapArray) {
        const loc = sitemap.loc || sitemap['sitemap:loc']
        if (loc && typeof loc === 'string') {
          // 이미 처리된 사이트맵 URL인지 확인 (무한 루프 방지)
          if (processedUrls.has(loc)) {
            this.logger.warn(`이미 처리된 사이트맵 URL 건너뜀: ${loc}`)
            continue
          }

          // 처리된 URL에 추가
          processedUrls.add(loc)

          try {
            this.logger.log(`하위 sitemap 처리: ${loc}`)
            const response = await axios.get(loc)
            const nestedUrls = await this.processXmlData(
              await this.parseXml(response.data),
              loc,
              indexingConfig,
              processedUrls,
            )
            urls.push(...nestedUrls)
            this.logger.log(`하위 sitemap 처리 완료: ${loc} (${nestedUrls.length}개 URL)`)
          } catch (error) {
            this.logger.error(`Sitemap 재귀 처리 실패: ${loc}`, error)
          }
        }
      }
    }
    // 2. urlset 처리 (최종 URL 리스트)
    else if (this.isUrlSet(data)) {
      this.logger.log('UrlSet 감지 - URL 리스트 추출')

      // 다양한 네임스페이스에서 URL 배열 추출
      let urlArray: UrlItem[] = []
      if (data.urlset && data.urlset.url) {
        urlArray = Array.isArray(data.urlset.url) ? data.urlset.url : [data.urlset.url]
        this.logger.log('표준 urlset 구조 사용')
      } else if (data['sitemap:urlset'] && data['sitemap:urlset']['sitemap:url']) {
        urlArray = Array.isArray(data['sitemap:urlset']['sitemap:url'])
          ? data['sitemap:urlset']['sitemap:url']
          : [data['sitemap:urlset']['sitemap:url']]
        this.logger.log('네임스페이스 urlset 구조 사용')
      }

      this.logger.log(`URL 개수: ${urlArray.length}`)

      for (const url of urlArray) {
        const loc = url.loc || url['sitemap:loc']
        if (loc && typeof loc === 'string') {
          // XML URL이 아닌 실제 페이지 URL만 처리
          if (!this.isXmlUrl(loc)) {
            urls.push({
              loc,
              lastmod: url.lastmod || url['sitemap:lastmod'] || undefined,
            })
          } else {
            this.logger.log(`XML URL 건너뜀: ${loc}`)
          }
        }
      }
    }
    // 4. 알 수 없는 형식
    else {
      this.logger.warn('알 수 없는 XML 형식:', Object.keys(data))
      this.logger.warn('사용 가능한 키들:', JSON.stringify(data, null, 2))
    }

    this.logger.log(`처리된 URL 개수: ${urls.length}`)

    // 5. 색인 기준에 따른 필터링
    const filteredUrls = this.filterUrlsByIndexingConfig(urls, indexingConfig)
    this.logger.log(`필터링 후 URL 개수: ${filteredUrls.length}`)

    return filteredUrls
  }

  /**
   * XML이 sitemapindex인지 확인
   */
  private isSitemapIndex(data: XmlData): boolean {
    // 다양한 네임스페이스 형태 지원
    return (
      (data.sitemapindex && data.sitemapindex.sitemap) ||
      (data['sitemap:urlset'] && data['sitemap:urlset']['sitemap:sitemap']) ||
      (data['sitemap:sitemapindex'] && data['sitemap:sitemapindex']['sitemap:sitemap'])
    )
  }

  /**
   * XML이 urlset인지 확인
   */
  private isUrlSet(data: XmlData): boolean {
    // 다양한 네임스페이스 형태 지원
    return (
      !!(data.urlset && data.urlset.url) ||
      !!(data['sitemap:urlset'] && data['sitemap:urlset']['sitemap:url']) ||
      !!(data['urlset'] && data['urlset']['url'])
    )
  }

  /**
   * XML 파싱 헬퍼 함수
   */
  private async parseXml(xmlText: string): Promise<XmlData> {
    const parser = new xml2js.Parser({
      explicitArray: false,
    })
    return await parser.parseStringPromise(xmlText)
  }

  /**
   * 색인 기준에 따라 URL 필터링
   */
  private filterUrlsByIndexingConfig(urls: SitemapUrl[], config?: IndexingConfig): SitemapUrl[] {
    if (!config || config.mode === 'all') {
      return urls
    }

    // lastmod 기준으로 정렬 (최신순)
    const sortedUrls = urls.sort((a, b) => {
      const dateA = a.lastmod ? new Date(a.lastmod).getTime() : 0
      const dateB = b.lastmod ? new Date(b.lastmod).getTime() : 0
      return dateB - dateA
    })

    switch (config.mode) {
      case 'recentCount':
        return sortedUrls.slice(0, config.count || 50)

      case 'recentDays':
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - (config.days || 7))
        return sortedUrls.filter(url => {
          if (!url.lastmod) return false
          return new Date(url.lastmod) >= cutoffDate
        })

      case 'fromDate':
        if (!config.startDate) return sortedUrls
        const startDate = new Date(config.startDate)
        return sortedUrls.filter(url => {
          if (!url.lastmod) return false
          return new Date(url.lastmod) >= startDate
        })

      default:
        return sortedUrls
    }
  }

  /**
   * URL이 XML 사이트맵인지 확인
   */
  private isXmlUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase()
    return (
      lowerUrl.endsWith('.xml') ||
      lowerUrl.includes('sitemap') ||
      lowerUrl.includes('sitemap_index') ||
      lowerUrl.includes('sitemap-index') ||
      lowerUrl.includes('rss') ||
      lowerUrl.includes('feed')
    )
  }
}

@Injectable()
export class SitemapQueueProcessor {
  private readonly logger = new Logger(SitemapQueueProcessor.name)
  private readonly processors: SitemapProcessor[] = []

  constructor(
    private readonly prisma: PrismaService,
    private readonly indexJobService: IndexJobService,
  ) {
    // 통합 처리기 등록
    this.processors = [new DefaultSitemapProcessor()]
  }

  /**
   * 10분마다 실행되는 cron 작업
   * 활성화된 사이트맵들을 파싱하고 새로운 URL들을 인덱싱 작업으로 생성
   */
  @Cron('0 */10 * * * *')
  async parseSitemaps(): Promise<void> {
    this.logger.log('Sitemap 파싱 작업 시작')

    try {
      // 활성화된 사이트맵 설정들을 조회
      const sitemapConfigs = await this.prisma.sitemapConfig.findMany({
        where: {
          isEnabled: true,
        },
        include: {
          site: true,
        },
      })

      for (const config of sitemapConfigs) {
        await this.processSitemapConfig(config)
      }
    } catch (error) {
      this.logger.error('Sitemap 파싱 중 오류 발생:', error)
    }
  }

  /**
   * 특정 사이트맵 설정을 처리
   */
  async processSitemapConfig(config: any): Promise<void> {
    try {
      this.logger.log(`사이트맵 "${config.name}" (${config.sitemapType}) 처리 시작`)

      // 색인 기준 설정 파싱
      const indexingConfig = this.parseIndexingConfig(config.site.indexingConfig)

      // sitemap URL 생성
      const sitemapUrl = this.generateSitemapUrl(config.site.siteUrl, config.sitemapType)

      // sitemap XML 가져오기 (axios 사용)
      const response = await axios.get(sitemapUrl)
      const xmlText = response.data

      // Content-Type 확인 (HTML 응답 방지)
      const contentType = response.headers['content-type'] || ''
      if (contentType.includes('text/html')) {
        this.logger.warn(`사이트맵 "${config.name}": HTML 응답 감지, 건너뜀`)
        return
      }

      // 플랫폼별 처리기 찾기
      const processor = this.processors.find(p => p.canProcess(config.sitemapType))
      if (!processor) {
        throw new Error(`지원하지 않는 사이트맵 타입: ${config.sitemapType}`)
      }

      // 처리된 사이트맵 URL 추적을 위한 Set 초기화
      const processedSitemapUrls = new Set<string>()

      // 플랫폼별 처리 (색인 기준 포함, 처리된 URL 추적)
      const urls = await processor.processSitemap(xmlText, sitemapUrl, indexingConfig, processedSitemapUrls)

      // 새로운 URL들 찾기
      const newUrls = await this.findNewUrls(config.siteId, urls)

      // 새 URL들을 모아 한 번에 인덱싱 Job 생성 (사이트 단위 벌크)
      if (newUrls.length > 0) {
        await this.indexJobService.createBulk({ urls: newUrls.map(u => u.loc) })
      }

      // 마지막 파싱 시간 업데이트
      await (this.prisma as any).sitemapConfig.update({
        where: { id: config.id },
        data: { lastParsed: new Date() },
      })

      this.logger.log(
        `사이트맵 "${config.name}": ${newUrls.length}개의 새로운 URL 벌크 작업 생성 (전체 파싱: ${urls.length}개)`,
      )
    } catch (error) {
      this.logger.error(`사이트맵 "${config.name}" 처리 중 오류:`, error)
    }
  }

  /**
   * 색인 기준 설정 파싱
   */
  private parseIndexingConfig(configStr: string): IndexingConfig {
    try {
      const config = JSON.parse(configStr)
      return {
        mode: config.mode || 'recentCount',
        count: config.count || 50,
        days: config.days || 7,
        startDate: config.startDate,
      }
    } catch {
      // 기본값 반환
      return {
        mode: 'recentCount',
        count: 50,
      }
    }
  }

  /**
   * 사이트맵 타입에 따라 URL 생성
   */
  private generateSitemapUrl(siteUrl: string, sitemapType: string): string {
    const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl

    switch (sitemapType) {
      case 'blogspot':
        return `${baseUrl}/sitemap.xml`
      case 'tistory':
        return `${baseUrl}/sitemap.xml`
      case 'wordpress':
        return `${baseUrl}/sitemap.xml`
      case 'custom':
        return `${baseUrl}/sitemap.xml`
      default:
        return `${baseUrl}/sitemap.xml`
    }
  }

  /**
   * 새로운 URL들 찾기 (중복되지 않은 것들)
   */
  private async findNewUrls(siteId: number, urls: SitemapUrl[]): Promise<SitemapUrl[]> {
    const newUrls: SitemapUrl[] = []

    for (const url of urls) {
      // 이미 처리된 URL인지 확인 (Index 테이블에서 체크)
      const existingJob = await (this.prisma as any).index.findFirst({
        where: {
          siteId,
          url: url.loc,
        },
      })

      if (!existingJob) {
        newUrls.push(url)
      }
    }

    return newUrls
  }

  /**
   * 검색엔진별 설정 가져오기
   */
  private getEngineConfig(site: any, engine: string): EngineConfig | null {
    const configMap: Record<string, string> = {
      GOOGLE: site.googleConfig,
      NAVER: site.naverConfig,
      DAUM: site.daumConfig,
      BING: site.bingConfig,
    }

    const configStr = configMap[engine]
    if (!configStr) return null

    try {
      return JSON.parse(configStr) as EngineConfig
    } catch {
      return null
    }
  }
}
