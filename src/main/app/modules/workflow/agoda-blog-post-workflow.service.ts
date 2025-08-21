import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AgodaSearchService } from '@main/app/modules/agoda-search/agoda-search.service'
import { CreateAgodaBlogPostJobDto } from '@main/app/modules/job/agoda-blog-post-job/dto'
import { BlogType } from '../job/job.types'
import { AgodaBlogPostJobCrudService } from '@main/app/modules/job/agoda-blog-post-job/agoda-blog-post-job.crud.service'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

@Injectable()
export class AgodaBlogPostWorkflowService {
  private readonly logger = new Logger(AgodaBlogPostWorkflowService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly agodaBlogPostJobCrudService: AgodaBlogPostJobCrudService,
    private readonly agodaSearch: AgodaSearchService,
  ) {}

  parseBlogType(value: string): BlogType {
    const v = (value || '').toLowerCase().trim()
    switch (v) {
      case 'tistory':
      case '티스토리':
        return BlogType.TISTORY
      case 'wordpress':
      case '워드프레스':
        return BlogType.WORDPRESS
      case 'google_blog':
      case '구글':
      case '블로거':
      case '블로그스팟':
      case '구글블로그':
      default:
        return BlogType.GOOGLE_BLOG
    }
  }

  private async validatePublishId(blogType: BlogType, id: number): Promise<{ accountId: number; accountName: string }> {
    switch (blogType) {
      case BlogType.GOOGLE_BLOG: {
        const acc = await this.prisma.bloggerAccount.findFirst({ where: { id } })
        assert(acc, `Blogger 계정을 찾을 수 없습니다: ${id}`)
        return { accountId: acc.id, accountName: acc.name }
      }
      case BlogType.TISTORY: {
        const acc = await this.prisma.tistoryAccount.findFirst({ where: { id } })
        assert(acc, `Tistory 계정을 찾을 수 없습니다: ${id}`)
        return { accountId: acc.id, accountName: acc.name }
      }
      case BlogType.WORDPRESS: {
        const acc = await this.prisma.wordPressAccount.findFirst({ where: { id } })
        assert(acc, `WordPress 계정을 찾을 수 없습니다: ${id}`)
        return { accountId: acc.id, accountName: acc.name }
      }
    }
  }

  async createFromManualInput(data: any) {
    const urls = String(data.agodaUrl || '')
      .split(/\r?\n/)
      .map((u: string) => u.trim())
      .filter((u: string) => u.length > 0)

    assert(urls.length > 0, '아고다 URL은 최소 1개 이상이어야 합니다.')
    if (urls.length > 5) throw new Error('아고다 비교 URL은 최대 5개까지 입력할 수 있습니다.')

    const blogType = this.parseBlogType(data.blogType)
    const publish = await this.validatePublishId(blogType, data.accountId)

    const dto: CreateAgodaBlogPostJobDto = {
      subject: '아고다 포스팅',
      desc: '워크플로우로 생성된 아고다 포스팅 작업',
      agodaUrls: urls,
      title: '',
      content: '',
      category: data.category,
      scheduledAt: data.scheduledAt,
      bloggerAccountId: blogType === BlogType.GOOGLE_BLOG ? publish.accountId : undefined,
      wordpressAccountId: blogType === BlogType.WORDPRESS ? publish.accountId : undefined,
      tistoryAccountId: blogType === BlogType.TISTORY ? publish.accountId : undefined,
      immediateRequest: data.immediateRequest !== false,
    }

    const result = await this.agodaBlogPostJobCrudService.createAgodaBlogPostJob(dto)
    return { totalProcessed: 1, success: 1, failed: 0, jobIds: [result.jobId], errors: [] }
  }

  // 검색 엔드포인트: 키워드로 아고다 상위 URL n개 조회 (AgodaSearchService 경유)
  async searchAgoda(keyword: string, limit: number = 5): Promise<{ title: string; url: string }[]> {
    return await this.agodaSearch.search(keyword, limit)
  }
}
