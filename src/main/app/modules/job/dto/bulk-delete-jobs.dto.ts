import { IsArray, IsNotEmpty, IsString, ArrayMinSize } from 'class-validator'

export class BulkDeleteJobsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ArrayMinSize(1)
  jobIds: string[]
}
