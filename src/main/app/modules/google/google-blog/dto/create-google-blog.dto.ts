import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator'

export class CreateGoogleBlogDto {
  @IsNumber()
  oauthId: number

  @IsString()
  @IsNotEmpty()
  bloggerBlogId: string

  @IsString()
  @IsNotEmpty()
  bloggerBlogName: string

  @IsString()
  @IsNotEmpty()
  name: string

  @IsOptional()
  @IsString()
  desc?: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @IsOptional()
  @IsString()
  defaultVisibility?: 'public' | 'private'

  @IsOptional()
  @IsUrl()
  url?: string
}
