import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateNaverAccountDto {
  @IsString()
  @IsNotEmpty({ message: '계정 이름은 필수입니다.' })
  name: string

  @IsString()
  @IsNotEmpty({ message: '네이버 아이디는 필수입니다.' })
  naverId: string

  @IsString()
  @IsNotEmpty({ message: '비밀번호는 필수입니다.' })
  password: string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}
