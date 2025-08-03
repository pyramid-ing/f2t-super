import { IsString, IsNotEmpty } from 'class-validator'

export class ValidateAIKeyDto {
  @IsString()
  @IsNotEmpty()
  apiKey: string
}

export class ValidateAIKeyResponseDto {
  valid: boolean
  error?: string
  model?: string
}
