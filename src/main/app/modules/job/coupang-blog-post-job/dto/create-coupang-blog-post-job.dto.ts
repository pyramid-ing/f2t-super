import { IsString, IsNotEmpty, IsOptional, IsDateString, IsNumber, IsArray, ArrayNotEmpty } from 'class-validator'

export class CreateCoupangBlogPostJobDto {
  @IsString()
  @IsNotEmpty()
  subject: string

  @IsString()
  @IsNotEmpty()
  desc: string

  @IsArray()
  @ArrayNotEmpty()
  coupangUrls: string[]

  @IsOptional()
  @IsString()
  coupangAffiliateLink?: string

  @IsString()
  @IsNotEmpty()
  title: string

  @IsString()
  @IsNotEmpty()
  content: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  labels?: any

  @IsOptional()
  tags?: any

  @IsOptional()
  @IsNumber()
  bloggerAccountId?: number

  @IsOptional()
  @IsNumber()
  wordpressAccountId?: number

  @IsOptional()
  @IsNumber()
  tistoryAccountId?: number

  @IsOptional()
  @IsDateString()
  scheduledAt?: string

  @IsOptional()
  @IsNumber()
  priority?: number
}
