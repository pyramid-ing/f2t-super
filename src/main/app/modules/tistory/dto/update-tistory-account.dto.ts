import { PartialType } from '@nestjs/mapped-types'
import { Validate, ValidateIf } from 'class-validator'
import { validateTistoryUrl } from '@main/app/utils'
import { CreateTistoryAccountDto } from './create-tistory-account.dto'

// 티스토리 URL 검증 데코레이터
function IsTistoryUrl() {
  return Validate(
    (value: string) => {
      if (!value) return true // 업데이트에서는 선택적이므로 빈 값은 허용
      return validateTistoryUrl(value)
    },
    {
      message: '티스토리 URL은 tistory.com 도메인을 포함해야 합니다.',
    },
  )
}

export class UpdateTistoryAccountDto extends PartialType(CreateTistoryAccountDto) {
  @ValidateIf(o => o.tistoryUrl !== undefined)
  @IsTistoryUrl()
  tistoryUrl?: string
}
