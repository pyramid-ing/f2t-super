import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator'
import { AgodaBlogPostJobStatus } from '../agoda-blog-post-job.types'

export class UpdateAgodaBlogPostJobDto {
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
  @IsEnum(AgodaBlogPostJobStatus)
  status?: AgodaBlogPostJobStatus

  @IsOptional()
  @IsString()
  resultUrl?: string

  @IsOptional()
  @IsString()
  agodaAffiliateLink?: string

  @IsOptional()
  @IsDateString()
  publishedAt?: string
}
