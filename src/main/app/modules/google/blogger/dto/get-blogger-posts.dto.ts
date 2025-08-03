import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator'
import { Transform } from 'class-transformer'

export class GetBloggerPostsDto {
  @IsOptional()
  @IsString()
  blogId?: string

  @IsOptional()
  @IsString()
  blogUrl?: string

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  maxResults?: number = 10

  @IsOptional()
  @IsString()
  pageToken?: string

  @IsOptional()
  @IsIn(['live', 'draft', 'scheduled'])
  status?: 'live' | 'draft' | 'scheduled' = 'live'

  @IsString()
  googleOAuthId: string
}
