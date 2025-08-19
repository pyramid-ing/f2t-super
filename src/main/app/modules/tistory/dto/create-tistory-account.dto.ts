import { IsString, IsOptional, IsUrl, Validate } from 'class-validator'
import { validateTistoryUrl } from '@main/app/utils'

// 티스토리 URL 검증 데코레이터
function IsTistoryUrl() {
  return Validate(
    (value: string) => {
      if (!value) return false
      return validateTistoryUrl(value)
    },
    {
      message: '티스토리 URL은 tistory.com 도메인을 포함해야 합니다.',
    },
  )
}

export class CreateTistoryAccountDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  desc?: string

  @IsUrl()
  @IsTistoryUrl()
  tistoryUrl: string

  @IsOptional()
  @IsUrl()
  url?: string

  @IsString()
  loginId: string

  @IsString()
  loginPassword: string

  @IsOptional()
  isDefault: boolean

  @IsOptional()
  @IsString()
  defaultVisibility?: 'public' | 'private'
}
