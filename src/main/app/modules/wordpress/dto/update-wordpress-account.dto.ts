import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator'

export class UpdateWordPressAccountDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  desc?: string

  @IsOptional()
  @IsUrl()
  url?: string

  @IsOptional()
  @IsString()
  wpUsername?: string

  @IsOptional()
  @IsString()
  apiKey?: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}
