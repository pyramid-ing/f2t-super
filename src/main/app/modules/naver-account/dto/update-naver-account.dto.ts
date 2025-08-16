import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator'

export class UpdateNaverAccountDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  naverId?: string

  @IsString()
  @IsOptional()
  password?: string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean

  @IsBoolean()
  @IsOptional()
  isLoggedIn?: boolean

  @IsDate()
  @IsOptional()
  lastLogin?: Date
}
