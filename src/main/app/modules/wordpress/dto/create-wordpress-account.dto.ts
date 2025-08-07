import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator'

export class CreateWordPressAccountDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  desc?: string

  @IsUrl()
  url: string

  @IsString()
  wpUsername: string

  @IsString()
  apiKey: string

  @IsBoolean()
  isDefault: boolean
}
