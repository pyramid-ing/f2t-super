import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator'

export class PublishBloggerPostDto {
  @IsString()
  @IsNotEmpty()
  title: string

  @IsString()
  @IsNotEmpty()
  content: string

  @IsString()
  @IsOptional()
  bloggerBlogId?: string

  @IsString()
  googleOAuthId: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[]
}
