import { Module } from '@nestjs/common'
import { CoupangBlogPostJobController } from './coupang-blog-post-job.controller'
import { CoupangBlogPostJobService } from './coupang-blog-post-job.service'

@Module({
  controllers: [CoupangBlogPostJobController],
  providers: [CoupangBlogPostJobService],
  exports: [CoupangBlogPostJobService],
})
export class CoupangBlogPostJobModule {}
