import { IsArray, IsNotEmpty, IsString, ArrayMinSize } from 'class-validator'

export class BulkRetryJobsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ArrayMinSize(1)
  jobIds: string[]
}
