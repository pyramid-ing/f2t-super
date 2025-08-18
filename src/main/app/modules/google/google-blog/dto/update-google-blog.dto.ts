import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator'

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
  @IsUrl()
  url?: string
}
