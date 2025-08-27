import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator'
import { Transform } from 'class-transformer'

export class UpdateGoogleBlogDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  desc?: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUrl()
  url?: string
}
