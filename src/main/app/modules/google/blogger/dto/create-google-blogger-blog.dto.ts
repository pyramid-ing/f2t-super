import { IsString, IsOptional, IsBoolean } from 'class-validator'

export class CreateGoogleBloggerBlogDto {
  @IsString()
  bloggerBlogId: string

  @IsString()
  @IsOptional()
  blogName?: string

  @IsString()
  @IsOptional()
  blogUrl?: string

  @IsString()
  googleOauthId: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}
