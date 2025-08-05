import { IsOptional, IsString, IsEnum } from 'class-validator'
import { JobStatus } from '../job.types'

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  scheduledAt?: string

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus

  @IsOptional()
  @IsString()
  subject?: string

  @IsOptional()
  @IsString()
  desc?: string
}
