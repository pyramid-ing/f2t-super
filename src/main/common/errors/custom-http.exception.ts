import { ErrorCode } from './error-code.enum'
import { ErrorCodeMap } from './error-code.map'

export class CustomHttpException extends Error {
  constructor(
    public readonly errorCode: ErrorCode,
    public readonly metadata?: Record<string, any>,
  ) {
    const errorMeta = ErrorCodeMap[errorCode]
    let message = errorMeta ? errorMeta.message(metadata) : errorCode.toString()
    message = `[${errorCode}] ${message}`
    super(message)
  }
}
