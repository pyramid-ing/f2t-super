import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator'
import { Type } from 'class-transformer'
import { CreateCoupangReviewPostingDto } from './create-coupang-review-posting.dto'

export class CreateCoupangReviewPostingBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCoupangReviewPostingDto)
  items: CreateCoupangReviewPostingDto[]
}
