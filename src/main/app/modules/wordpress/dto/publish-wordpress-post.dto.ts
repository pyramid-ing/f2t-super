import { IsString, IsNumber, IsNotEmpty, IsOptional, IsArray } from 'class-validator'

export class PublishWordPressPostDto {
  @IsNumber()
  accountId: number

  @IsString()
  @IsNotEmpty()
  title: string

  @IsString()
  @IsNotEmpty()
  content: string

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  categories?: number[]

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tags?: number[]
}
