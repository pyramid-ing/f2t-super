import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { BlogPostJobType } from '../../job/job.types'
import { BlogType } from '../../job/job.types'

@Injectable()
export class UrlUpdateService {
  private readonly logger = new Logger(UrlUpdateService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 기존 포스트들의 resultUrl을 새로운 URL로 업데이트
   */
  public async updateExistingPostUrls(
    accountId: number,
    oldUrl: string | null,
    newUrl: string | null,
    blogType: BlogType,
  ): Promise<void> {
    if (!oldUrl || !newUrl) {
      return // URL이 null인 경우 업데이트하지 않음
    }

    // 모든 블로그 포스트 작업에서 해당 계정으로 발행된 포스트들의 resultUrl 업데이트
    const jobTypes = Object.values(BlogPostJobType)

    for (const jobType of jobTypes) {
      const jobs = await this._findJobsByAccountType(jobType, accountId, blogType)

      for (const job of jobs) {
        if (job.resultUrl) {
          // 기존 URL에서 path 부분만 추출하여 새로운 URL과 결합
          const oldUrlObj = new URL(job.resultUrl)
          const newUrlObj = new URL(newUrl)

          // 새로운 URL의 host와 기존 URL의 path를 결합
          const updatedUrl = `${newUrlObj.protocol}//${newUrlObj.host}${oldUrlObj.pathname}${oldUrlObj.search}${oldUrlObj.hash}`

          await this.prisma[jobType].update({
            where: { id: job.id },
            data: { resultUrl: updatedUrl },
          })
          this.logger.log(`${jobType} ID ${job.id}의 resultUrl 업데이트: ${job.resultUrl} → ${updatedUrl}`)
        }
      }
    }
  }

  /**
   * 블로그 타입에 따라 해당하는 작업들을 찾습니다
   */
  private async _findJobsByAccountType(jobType: string, accountId: number, blogType: BlogType) {
    const whereCondition: any = {}

    switch (blogType) {
      case BlogType.TISTORY:
        whereCondition.tistoryAccountId = accountId
        break
      case BlogType.WORDPRESS:
        whereCondition.wordpressAccountId = accountId
        break
      case BlogType.GOOGLE_BLOG:
        whereCondition.bloggerAccountId = accountId
        break
    }

    return await this.prisma[jobType].findMany({
      where: whereCondition,
    })
  }
}
