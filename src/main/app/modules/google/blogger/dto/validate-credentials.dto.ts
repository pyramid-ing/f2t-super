import { IsString, IsNotEmpty } from 'class-validator'

export class ValidateCredentialsDto {
  @IsString()
  @IsNotEmpty()
  clientId: string

  @IsString()
  @IsNotEmpty()
  clientSecret: string
}
