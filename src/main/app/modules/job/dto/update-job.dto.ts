import { IsOptional, IsString, IsEnum, IsNumber } from 'class-validator'
import { JobStatus } from '../job.types'

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  scheduledAt?: string

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus

  @IsOptional()
  @IsString()
  subject?: string

  @IsOptional()
  @IsString()
  desc?: string

  // 블로그 계정 변경 (InfoBlogJob/CoupangBlogJob 공용)
  @IsOptional()
  @IsNumber()
  bloggerAccountId?: number

  @IsOptional()
  @IsNumber()
  wordpressAccountId?: number

  @IsOptional()
  @IsNumber()
  tistoryAccountId?: number
}
