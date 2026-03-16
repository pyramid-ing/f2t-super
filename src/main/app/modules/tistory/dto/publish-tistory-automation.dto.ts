import { IsString, IsNotEmpty, IsArray, IsOptional, IsIn, IsDateString } from 'class-validator'

export class PublishTistoryAutomationDto {
  @IsString()
  @IsNotEmpty()
  title: string

  @IsString()
  @IsNotEmpty()
  contentHtml: string

  @IsArray()
  @IsString({ each: true })
  keywords: string[]

  @IsString()
  @IsNotEmpty()
  tistoryUrl: string

  @IsString()
  @IsNotEmpty()
  kakaoId: string

  @IsString()
  @IsNotEmpty()
  kakaoPw: string

  @IsString()
  @IsOptional()
  category?: string

  @IsString()
  @IsOptional()
  thumbnailPath?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imagePaths?: string[]

  @IsOptional()
  @IsIn(['public', 'private', 'protected'])
  postVisibility?: 'public' | 'private' | 'protected'

  @IsOptional()
  @IsDateString()
  scheduledAt?: string
}
