import { IsString, IsNumber } from 'class-validator'

export class UploadTistoryImageDto {
  @IsNumber()
  accountId: number

  @IsString()
  imagePath: string

  @IsString()
  fileName: string
}
