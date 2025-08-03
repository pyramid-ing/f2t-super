import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber } from 'class-validator'

export class CreateCoupangReviewPostingDto {
  @IsString()
  @IsNotEmpty()
  coupangUrl: string

  @IsEnum(['wordpress', 'tistory', 'google'])
  blogType: 'wordpress' | 'tistory' | 'google'

  @IsOptional()
  @IsNumber()
  accountId?: number
}
