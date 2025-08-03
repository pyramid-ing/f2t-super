import { PartialType } from '@nestjs/mapped-types'
import { CreateWordPressAccountDto } from './create-wordpress-account.dto'

export class UpdateWordPressAccountDto extends PartialType(CreateWordPressAccountDto) {}
