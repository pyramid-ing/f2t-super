import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { SitemapQueueProcessor } from './sitemap-queue.processor'
import { IndexingConfig, CreateSitemapConfigDto, UpdateSitemapConfigDto, SitemapParseResult } from './sitemap.types'

@Injectable()
export class SitemapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sitemapQueueProcessor: SitemapQueueProcessor,
  ) {}

  /**
   * 사이트의 모든 사이트맵 설정 가져오기
   */
  async getSitemapConfigs(siteId: number): Promise<any[]> {
    return this.prisma.sitemapConfig.findMany({
      where: { siteId },
      include: { site: true },
    })
  }

  /**
   * 사이트맵 설정 생성
   */
  async createSitemapConfig(siteId: number, data: CreateSitemapConfigDto): Promise<any> {
    return this.prisma.sitemapConfig.create({
      data: {
        name: data.name,
        sitemapType: data.sitemapType,
        isEnabled: data.isEnabled ?? true,
        site: {
          connect: { id: siteId },
        },
      },
      include: { site: true },
    })
  }

  /**
   * 사이트맵 설정 업데이트
   */
  async updateSitemapConfig(id: string, data: UpdateSitemapConfigDto): Promise<any> {
    return this.prisma.sitemapConfig.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        sitemapType: data.sitemapType,
        isEnabled: data.isEnabled,
      },
      include: { site: true },
    })
  }

  /**
   * 사이트맵 설정 삭제
   */
  async deleteSitemapConfig(id: string): Promise<any> {
    return this.prisma.sitemapConfig.delete({
      where: { id: parseInt(id) },
    })
  }

  /**
   * 사이트의 색인 기준 설정 가져오기
   */
  async getIndexingConfig(siteId: number): Promise<IndexingConfig> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    })

    if (!site) {
      throw new Error('사이트를 찾을 수 없습니다.')
    }

    try {
      return JSON.parse(site.indexingConfig)
    } catch {
      // 기본값 반환
      return {
        mode: 'recentCount',
        count: 50,
      }
    }
  }

  /**
   * 사이트의 색인 기준 설정 업데이트
   */
  async updateIndexingConfig(siteId: number, config: IndexingConfig): Promise<any> {
    return this.prisma.site.update({
      where: { id: siteId },
      data: {
        indexingConfig: JSON.stringify(config),
      },
    })
  }

  /**
   * 사이트의 인덱싱 작업 목록 가져오기
   */
  async getIndexJobs(siteId: number, page = 1, limit = 50) {
    const skip = (page - 1) * limit

    const [jobs, total] = await Promise.all([
      this.prisma.indexJob.findMany({
        where: { siteId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { job: true },
      }),
      this.prisma.indexJob.count({
        where: { siteId },
      }),
    ])

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * 수동으로 sitemap 파싱 실행
   */
  async parseSitemap(siteId: number): Promise<SitemapParseResult> {
    try {
      // 해당 사이트의 모든 사이트맵 설정들을 조회 (활성/비활성 상관없이)
      const sitemapConfigs = await this.prisma.sitemapConfig.findMany({
        where: {
          siteId,
        },
        include: {
          site: true,
        },
      })

      if (sitemapConfigs.length === 0) {
        return {
          message: '사이트맵 설정이 없습니다.',
          processedUrls: 0,
          newUrls: 0,
        }
      }

      let totalProcessed = 0
      let totalNew = 0

      // 각 사이트맵 설정에 대해 파싱 실행
      for (const config of sitemapConfigs) {
        await this.sitemapQueueProcessor.processSitemapConfig(config)
        // 실제 처리된 URL 수는 로그에서 확인 가능
        totalProcessed += 1 // 설정당 1개씩 카운트
      }

      return {
        message: `${sitemapConfigs.length}개의 사이트맵 파싱이 완료되었습니다.`,
        processedUrls: totalProcessed,
        newUrls: totalNew,
      }
    } catch (error) {
      throw new Error(`사이트맵 파싱 중 오류가 발생했습니다: ${error.message}`)
    }
  }
}
