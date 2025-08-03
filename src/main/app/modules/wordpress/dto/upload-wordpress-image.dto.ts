import { IsString, IsNumber } from 'class-validator'

export class UploadWordPressImageDto {
  @IsNumber()
  accountId: number

  @IsString()
  imagePath: string

  @IsString()
  fileName: string
}
