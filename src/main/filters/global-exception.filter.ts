import { ErrorCodeMap } from '@main/common/errors/error-code.map'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { AxiosError } from 'axios'

interface ErrorResponse {
  success: false
  statusCode: number
  timestamp: string
  path: string
  error: string
  message: string
  code?: ErrorCode
  service?: string
  operation?: string
  details?: any
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()
    const req = ctx.getRequest()

    let statusCode = 500
    let message = '서버 오류가 발생했습니다.'
    let error = 'Unknown Error'
    let code: ErrorCode = ErrorCode.INTERNAL_ERROR
    let service: string | undefined
    let operation: string | undefined
    let details: any = null

    // HttpException 처리
    if (exception instanceof HttpException) {
      const response = exception.getResponse() as any
      statusCode = exception.getStatus()

      if (typeof response === 'string') {
        message = response
      } else if (response && typeof response === 'object') {
        message = response.message || '요청 처리 중 오류가 발생했습니다.'
        error = response.error || 'HttpException'
        if (response.errorCode) {
          code = response.errorCode
        }
      }

      details = {
        stack: this.formatStackTrace(exception.stack),
        name: exception.name,
      }
    }
    // CustomHttpException 처리
    else if (exception instanceof CustomHttpException) {
      code = exception.errorCode
      // 에러 스택에서 서비스와 작업 정보 추출
      const stackInfo = this.extractServiceAndOperation(exception.stack)
      service = stackInfo.service
      operation = stackInfo.operation
      const mapped = ErrorCodeMap[code]
      if (mapped) {
        statusCode = mapped.status
        message = mapped.message(exception.metadata || {})
      }

      details = {
        ...exception.metadata,
        stack: this.formatStackTrace(exception.stack),
        name: exception.name,
      }
    }
    // AxiosError 처리 (외부 API 에러)
    else if (exception instanceof AxiosError) {
      statusCode = exception.response?.status || 502
      message = this.getAxiosErrorMessage(exception)
      error = 'External API Error'
      code = ErrorCode.EXTERNAL_API_FAIL

      details = {
        url: exception.config?.url,
        method: exception.config?.method?.toUpperCase(),
        response: exception.response?.data,
        code: exception.code,
        stack: this.formatStackTrace(exception.stack),
      }
    }
    // 일반 Error 처리
    else if (exception instanceof Error) {
      message = exception.message
      error = exception.name

      details = {
        stack: this.formatStackTrace(exception.stack),
        name: exception.name,
      }
    }
    // 기타 에러 처리
    else {
      message = exception?.message || '알 수 없는 오류가 발생했습니다.'
      error = exception?.name || 'UnknownError'

      details = {
        stack: this.formatStackTrace(exception?.stack),
        originalError: exception,
      }
    }

    const responseBody: ErrorResponse = {
      success: false,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.url,
      error,
      message,
      code,
      service,
      operation,
      details,
    }

    // 에러 로깅 (구조화된 로그)
    this.logger.error({
      message: `[${service || 'Unknown'}/${operation || 'Unknown'}] ${error}: ${message}`,
      path: responseBody.path,
      code,
      service,
      operation,
      details: responseBody.details,
      stack: exception instanceof Error ? exception.stack : undefined,
    })

    res.status(statusCode).json(responseBody)
  }

  private getAxiosErrorMessage(error: AxiosError): string {
    if (error.response) {
      return `External API responded with status ${error.response.status}: ${error.message}`
    } else if (error.request) {
      return 'No response received from external API'
    } else {
      return `Error setting up the request: ${error.message}`
    }
  }

  private extractServiceAndOperation(stack: string): { service: string; operation: string } {
    const match = stack.match(/at\s+(.+?)\s+\(/)
    if (!match) {
      return { service: 'Unknown', operation: 'Unknown' }
    }
    const filePath = match[1]
    const lastSlashIndex = filePath.lastIndexOf('/')
    const lastDotIndex = filePath.lastIndexOf('.')

    let service = 'Unknown'
    let operation = 'Unknown'

    if (lastSlashIndex !== -1 && lastDotIndex !== -1) {
      service = filePath.substring(lastSlashIndex + 1, lastDotIndex)
      operation = filePath.substring(lastDotIndex + 1)
    } else if (lastSlashIndex !== -1) {
      service = filePath.substring(lastSlashIndex + 1)
    } else if (lastDotIndex !== -1) {
      operation = filePath.substring(lastDotIndex + 1)
    }

    return { service, operation }
  }

  private formatStackTrace(stack: string | undefined): string[] | undefined {
    if (!stack) return undefined

    return stack
      .split('\n')
      .slice(1) // 첫 번째 줄(에러 메시지) 제외
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.includes('node_modules')) // node_modules 경로 제외
      .map(line => {
        // 파일 경로에서 프로젝트 루트 기준 상대 경로만 표시
        const match = line.match(/\((.+)\)/)
        if (match) {
          const path = match[1]
          // 프로젝트 경로에서 상대 경로 추출
          const projectPath = path.includes('f2t-super') ? path.split('f2t-super/').pop() : path
          return projectPath ? `at ${projectPath}` : line
        }
        return line
      })
  }
}
