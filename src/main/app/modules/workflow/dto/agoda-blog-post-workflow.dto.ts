import { IsString, IsNotEmpty, IsOptional, IsUrl, IsBoolean, IsNumber, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'

/**
 * 아고다 블로그 포스트 수동 입력 요청 DTO
 */
export class CreateAgodaBlogPostDto {
  @IsUrl()
  @IsNotEmpty()
  url: string

  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsBoolean()
  @IsOptional()
  immediateRequest?: boolean
}

/**
 * 아고다 검색 요청 DTO
 */
export class SearchAgodaDto {
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
