import { Module } from '@nestjs/common'
import { CoupangReviewPostingService } from './coupang-review-posting.service'
import { CoupangReviewPostingController } from './coupang-review-posting.controller'
import { PrismaModule } from '../common/prisma/prisma.module'
import { CoupangCrawlerModule } from '../coupang-crawler/coupang-crawler.module'
import { CoupangPartnersModule } from '../coupang-partners/coupang-partners.module'
import { ContentGenerateModule } from '../content-generate/content-generate.module'
import { WordPressModule } from '../wordpress/wordpress.module'
import { TistoryModule } from '../tistory/tistory.module'
import { JobModule } from '../job/job.module'

@Module({
  imports: [
    PrismaModule,
    CoupangCrawlerModule,
    CoupangPartnersModule,
    ContentGenerateModule,
    WordPressModule,
    TistoryModule,
    JobModule,
  ],
  controllers: [CoupangReviewPostingController],
  providers: [CoupangReviewPostingService],
  exports: [CoupangReviewPostingService],
})
export class CoupangReviewPostingModule {}
