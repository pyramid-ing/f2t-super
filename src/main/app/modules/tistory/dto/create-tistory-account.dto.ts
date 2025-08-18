import { IsString, IsOptional, IsUrl } from 'class-validator'

export class CreateTistoryAccountDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  desc?: string

  @IsUrl()
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
