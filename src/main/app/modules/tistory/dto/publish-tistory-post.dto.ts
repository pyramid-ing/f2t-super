import { IsString, IsNumber, IsNotEmpty } from 'class-validator'

export class PublishTistoryPostDto {
  @IsNumber()
  accountId: number

  @IsString()
  @IsNotEmpty()
  title: string

  @IsString()
  @IsNotEmpty()
  content: string
}
