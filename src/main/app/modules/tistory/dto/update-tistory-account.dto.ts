import { PartialType } from '@nestjs/mapped-types'
import { CreateTistoryAccountDto } from './create-tistory-account.dto'

export class UpdateTistoryAccountDto extends PartialType(CreateTistoryAccountDto) {}
