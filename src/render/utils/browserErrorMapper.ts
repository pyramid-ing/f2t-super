/**
 * 브라우저 에러 코드를 ChromeInstallError 컴포넌트의 errorType으로 매핑합니다.
 */
export const mapBrowserErrorCode = (
  errorCode: number,
): 'not_installed' | 'permission_denied' | 'browser_error' | null => {
  switch (errorCode) {
    case 7001: // CHROME_NOT_INSTALLED
      return 'not_installed'
    case 7002: // CHROME_PERMISSION_DENIED
      return 'permission_denied'
    case 7003: // BROWSER_ERROR
      return 'browser_error'
    default:
      return null
  }
}

/**
 * 에러 메시지에서 브라우저 에러 타입을 감지합니다.
 */
export const detectBrowserErrorType = (
  errorMessage: string,
): 'not_installed' | 'permission_denied' | 'browser_error' | null => {
  const message = errorMessage.toLowerCase()

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
  if (chromeInstallPatterns.some(pattern => pattern.test(message))) {
    return 'not_installed'
  }

  // 크롬 권한 에러인지 확인
  if (chromePermissionPatterns.some(pattern => pattern.test(message))) {
    return 'permission_denied'
  }

  // 기타 브라우저 에러
  if (message.includes('browser') || message.includes('chrome')) {
    return 'browser_error'
  }

  return null
}
