import { IsString, IsNotEmpty, IsOptional, IsUrl, IsBoolean, IsNumber, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'

/**
 * 쿠팡 블로그 포스트 수동 입력 요청 DTO
 */
export class CreateCoupangBlogPostDto {
  @IsUrl()
  @IsNotEmpty()
  productUrl: string

  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  keyword?: string

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true'
    }
    return Boolean(value)
  })
  immediateRequest?: boolean
}

/**
 * 쿠팡 블로그 포스트 엑셀 업로드 요청 DTO
 */
export class UploadCoupangExcelDto {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true'
    }
    return Boolean(value)
  })
  immediateRequest?: boolean
}

/**
 * 쿠팡 검색 요청 DTO
 */
export class SearchCoupangDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  keyword: string

  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  @Transform(({ value }) => {
    const parsed = parseInt(value || '5', 10)
    return Math.min(5, Math.max(1, isNaN(parsed) ? 5 : parsed))
  })
  @IsOptional()
  limit?: number = 5
}
