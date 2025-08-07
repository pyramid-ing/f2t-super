import { ErrorCodeMap } from '@main/common/errors/error-code.map'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()

    let status = 500
    let errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR
    let message = '서버 오류가 발생했습니다.'
    let metadata: any = {}

    if (exception instanceof HttpException) {
      const response = exception.getResponse() as any
      status = exception.getStatus()

      // 원본 메시지를 그대로 사용
      if (typeof response === 'string') {
        message = response
      } else if (response && typeof response === 'object') {
        message = response.message || '요청 처리 중 오류가 발생했습니다.'
        // 추가 정보가 있다면 metadata에 포함
        if (response.error) {
          metadata.error = response.error
        }
        if ('statusCode' in response) {
          metadata.statusCode = response.statusCode
        }
      }
    } else if (exception instanceof CustomHttpException) {
      errorCode = exception.errorCode
      metadata = exception.metadata || {}

      const mapped = ErrorCodeMap[errorCode]
      if (mapped) {
        status = mapped.status
        message = mapped.message(metadata)
      }
    }

    res.status(status).json({
      success: false,
      errorCode,
      message,
      metadata,
    })
  }
}
