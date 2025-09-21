import { IsString, IsOptional, IsBoolean } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * 정보 블로그 포스트 워크플로우 업로드 요청 DTO
 */
export class UploadInfoBlogPostDto {
  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  category?: string

  @IsString()
  @IsOptional()
  tags?: string

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true'
    }
    return Boolean(value)
  })
  immediateRequest?: boolean

  @IsString()
  @IsOptional()
  publishType?: string

  @IsString()
  @IsOptional()
  visibility?: string
}
