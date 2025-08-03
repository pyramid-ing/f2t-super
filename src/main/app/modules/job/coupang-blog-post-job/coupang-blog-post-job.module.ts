import { Module } from '@nestjs/common'
import { CoupangBlogPostJobController } from './coupang-blog-post-job.controller'
import { CoupangBlogPostJobService } from './coupang-blog-post-job.service'
import { CoupangBlogPostJobProcessor } from '@main/app/modules/job/coupang-blog-post-job/coupang-blog-post-job.processor'
import { CoupangCrawlerModule } from '../../coupang-crawler/coupang-crawler.module'
import { CoupangPartnersModule } from '../../coupang-partners/coupang-partners.module'
import { AIModule } from '../../ai/ai.module'

@Module({
  imports: [CoupangCrawlerModule, CoupangPartnersModule, AIModule],
  controllers: [CoupangBlogPostJobController],
  providers: [CoupangBlogPostJobService, CoupangBlogPostJobProcessor],
  exports: [CoupangBlogPostJobService, CoupangBlogPostJobProcessor],
})
export class CoupangBlogPostJobModule {}
