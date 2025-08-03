import { PartialType } from '@nestjs/mapped-types'
import { CreateGoogleBloggerBlogDto } from './create-google-blogger-blog.dto'

export class UpdateGoogleBloggerBlogDto extends PartialType(CreateGoogleBloggerBlogDto) {}
