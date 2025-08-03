import { IsString, IsOptional, IsEnum } from 'class-validator'
import { CoupangBlogPostJobStatus } from '../coupang-blog-post-job.types'

export class UpdateCoupangBlogPostJobDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  content?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  labels?: any

  @IsOptional()
  tags?: any

  @IsOptional()
  @IsEnum(CoupangBlogPostJobStatus)
  status?: CoupangBlogPostJobStatus

  @IsOptional()
  @IsString()
  resultUrl?: string

  @IsOptional()
  @IsString()
  coupangAffiliateLink?: string
}
