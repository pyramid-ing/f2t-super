import React, { useState } from 'react'
import { Button, notification } from 'antd'
import { ChromeInstallError } from './ChromeInstallError'
import { mapBrowserErrorCode, detectBrowserErrorType } from '../utils/browserErrorMapper'

export const ChromeErrorUsage: React.FC = () => {
  const [browserError, setBrowserError] = useState<'not_installed' | 'permission_denied' | 'browser_error' | null>(null)

  // 브라우저 에러 시뮬레이션
  const simulateBrowserError = (errorType: 'not_installed' | 'permission_denied' | 'browser_error') => {
    setBrowserError(errorType)

    // 실제로는 여기서 API 호출 후 에러가 발생했을 때 처리
    notification.error({
      message: '브라우저 오류',
      description: '브라우저 실행 중 오류가 발생했습니다.',
    })
  }

  // 실제 API 에러 처리 예시
  const handleApiError = (error: any) => {
    // 방법 1: 에러 코드로 매핑
    if (error.code) {
      const errorType = mapBrowserErrorCode(error.code)
      if (errorType) {
        setBrowserError(errorType)
        return
      }
    }

    // 방법 2: 에러 메시지로 감지
    if (error.message) {
      const errorType = detectBrowserErrorType(error.message)
      if (errorType) {
        setBrowserError(errorType)
        return
      }
    }

    // 브라우저 에러가 아닌 경우 일반 에러 처리
    notification.error({
      message: '오류 발생',
      description: error.message || '알 수 없는 오류가 발생했습니다.',
    })
  }

  // 에러 초기화
  const clearError = () => {
    setBrowserError(null)
  }

  // 브라우저 에러가 있으면 에러 컴포넌트 표시
  if (browserError) {
    return (
      <div>
        <ChromeInstallError errorType={browserError} />
        <Button onClick={clearError} style={{ marginTop: 16 }}>
          에러 초기화
        </Button>
      </div>
    )
  }

  // 정상 상태
  return (
    <div>
      <h3>브라우저 에러 처리 예시</h3>
      <p>아래 버튼을 클릭하여 다양한 브라우저 에러를 시뮬레이션할 수 있습니다.</p>

      <div style={{ marginTop: 16 }}>
        <Button onClick={() => simulateBrowserError('not_installed')} style={{ marginRight: 8 }}>
          크롬 설치 에러 시뮬레이션
        </Button>

        <Button onClick={() => simulateBrowserError('permission_denied')} style={{ marginRight: 8 }}>
          크롬 권한 에러 시뮬레이션
        </Button>

        <Button onClick={() => simulateBrowserError('browser_error')}>일반 브라우저 에러 시뮬레이션</Button>
      </div>

      <div style={{ marginTop: 24, padding: 16, border: '1px solid #d9d9d9', borderRadius: 6 }}>
        <h4>실제 사용 예시</h4>
        <p>API 호출 시 에러 처리를 시뮬레이션합니다:</p>

        <div style={{ marginTop: 8 }}>
          <Button
            onClick={() => handleApiError({ code: 7001, message: '크롬이 설치되어 있지 않습니다.' })}
            style={{ marginRight: 8 }}
          >
            에러 코드 7001 시뮬레이션
          </Button>

          <Button
            onClick={() => handleApiError({ code: 7002, message: '크롬 실행 권한이 없습니다.' })}
            style={{ marginRight: 8 }}
          >
            에러 코드 7002 시뮬레이션
          </Button>

          <Button onClick={() => handleApiError({ message: "executable doesn't exist: /usr/bin/google-chrome" })}>
            에러 메시지 감지 시뮬레이션
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ChromeErrorUsage
