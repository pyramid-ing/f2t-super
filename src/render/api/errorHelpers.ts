import { AxiosError } from 'axios'
import type { NormalizedError } from './error.type'

// 에러 코드 → 친화적 메시지 매핑
const FRIENDLY_MESSAGES: Record<string | number, string> = {
  // 기본 블로그 관련
  5604: '기본 블로그 1개는 필수입니다.', // NO_DEFAULT_ACCOUNT
  4807: '기본 블로그 1개는 필수입니다.', // GOOGLE_BLOG_NO_DEFAULT
  5406: '기본 블로그 1개는 필수입니다.', // TISTORY_DEFAULT_NOT_SET
  NO_DEFAULT_ACCOUNT: '기본 블로그 1개는 필수입니다.', // 백엔드에서 문자열 코드로 던지는 경우 대응
  BLOG_ACCOUNT_NOT_CONFIGURED: '기본 블로그 1개는 필수입니다.',
}

export function errorNormalizer(error: any): NormalizedError {
  if (error.isAxiosError) {
    const resp = (error as AxiosError).response
    if (resp && resp.data) {
      const data = resp.data as any
      const rawCode = data.errorCode ?? resp.status
      const friendly = FRIENDLY_MESSAGES[rawCode as any]
      return {
        success: false,
        errorCode: rawCode,
        message: friendly || data.message || resp.statusText || '알 수 없는 오류',
        metadata: data.metadata,
      }
    }
    // 서버 응답이 없는 경우 (네트워크, 타임아웃 등)
    return {
      success: false,
      message: error.message || '네트워크 오류가 발생했습니다.',
    }
  } else if (error instanceof Error) {
    return {
      success: false,
      message: error.message,
    }
  }
  return {
    success: false,
    message: '알 수 없는 오류',
  }
}
