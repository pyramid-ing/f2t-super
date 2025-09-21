import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'

/**
 * 아고다 블로그 포스트 수동 입력 요청 DTO
 */
export class CreateAgodaBlogPostDto {
  @IsNumber()
  @IsNotEmpty({ message: '계정 ID는 필수입니다' })
  @Type(() => Number)
  accountId: number

  @IsString()
  @IsNotEmpty({ message: '아고다 URL은 필수입니다' })
  @Transform(({ value }) => value?.trim())
  agodaUrl: string

  @IsString()
  @IsNotEmpty({ message: '블로그 타입은 필수입니다' })
  @Transform(({ value }) => value?.trim())
  blogType: string

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
