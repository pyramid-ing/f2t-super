import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsBoolean } from 'class-validator'
import { Type, Transform } from 'class-transformer'

/**
 * 주제 찾기 요청 DTO
 */
export class FindTopicsDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  topic: string

  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  @Transform(({ value }) => {
    const parsed = parseInt(value || '10', 10)
    return Math.min(50, Math.max(1, isNaN(parsed) ? 10 : parsed))
  })
  @IsOptional()
  limit?: number = 10

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
