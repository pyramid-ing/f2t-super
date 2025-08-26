import { IsString, IsOptional, IsBoolean, IsUrl, IsEnum } from 'class-validator'
import { WordPressVisibility } from '../wordpress.types'

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

  @IsOptional()
  @IsEnum(WordPressVisibility)
  defaultVisibility?: WordPressVisibility
}
