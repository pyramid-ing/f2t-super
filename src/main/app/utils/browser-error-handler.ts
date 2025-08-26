import { Injectable, Logger } from '@nestjs/common'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class BrowserErrorHandler {
  private readonly logger = new Logger(BrowserErrorHandler.name)

  /**
   * 브라우저 관련 에러를 분석하고 적절한 에러 메시지를 반환합니다.
   */
  handleBrowserError(error: any): never {
    const errorMessage = error.message || error.toString()

    // 크롬 설치 관련 에러 패턴들
    const chromeInstallPatterns = [
      /executable doesn't exist/i,
      /executable path doesn't exist/i,
      /chrome.*not found/i,
      /browser.*not found/i,
      /executable.*not found/i,
      /chrome.*not installed/i,
      /browser.*not installed/i,
      /no chrome.*installation/i,
      /chrome.*missing/i,
      /browser.*missing/i,
    ]

    // 크롬 권한 관련 에러 패턴들
    const chromePermissionPatterns = [
      /permission denied/i,
      /access denied/i,
      /insufficient permissions/i,
      /cannot access/i,
      /eacces/i,
      /eperm/i,
    ]

    // 크롬 설치 에러인지 확인
    if (chromeInstallPatterns.some(pattern => pattern.test(errorMessage))) {
      this.logger.error('크롬 브라우저가 설치되지 않았습니다:', errorMessage)
      throw new CustomHttpException(ErrorCode.CHROME_NOT_INSTALLED, {
        message: '크롬 브라우저가 설치되어 있지 않습니다. https://www.google.com/chrome/ 에서 다운로드하여 설치하세요.',
        originalError: errorMessage,
      })
    }

    // 크롬 권한 에러인지 확인
    if (chromePermissionPatterns.some(pattern => pattern.test(errorMessage))) {
      this.logger.error('크롬 브라우저 실행 권한이 없습니다:', errorMessage)
      throw new CustomHttpException(ErrorCode.CHROME_PERMISSION_DENIED, {
        message: '크롬 브라우저 실행 권한이 없습니다. 관리자 권한으로 앱을 실행하거나 크롬을 다시 설치해보세요.',
        originalError: errorMessage,
      })
    }

    // 기타 브라우저 에러
    this.logger.error('브라우저 실행 중 오류가 발생했습니다:', errorMessage)
    throw new CustomHttpException(ErrorCode.BROWSER_ERROR, {
      message: '브라우저 실행 중 오류가 발생했습니다.',
      originalError: errorMessage,
    })
  }
}
