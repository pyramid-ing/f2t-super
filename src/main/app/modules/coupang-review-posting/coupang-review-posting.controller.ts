import { Controller, Post, Body } from '@nestjs/common'
import { CoupangReviewPostingService } from './coupang-review-posting.service'
import { CreateCoupangReviewPostingDto, CreateCoupangReviewPostingBulkDto } from './dto'
import { CoupangReviewPostingResult } from './coupang-review-posting.types'

@Controller('coupang-review-posting')
export class CoupangReviewPostingController {
  constructor(private readonly coupangReviewPostingService: CoupangReviewPostingService) {}

  @Post('single')
  async startSinglePosting(@Body() request: CreateCoupangReviewPostingDto): Promise<CoupangReviewPostingResult> {
    return this.coupangReviewPostingService.startSinglePosting(request)
  }

  @Post('bulk')
  async startBulkPosting(@Body() request: CreateCoupangReviewPostingBulkDto): Promise<CoupangReviewPostingResult[]> {
    return this.coupangReviewPostingService.startBulkPosting(request)
  }
}
