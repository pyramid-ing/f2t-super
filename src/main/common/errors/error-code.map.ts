import { ErrorCode } from './error-code.enum'

export interface ErrorCodeMeta {
  status: number
  message: (metadata?: Record<string, any>) => string
}

export const ErrorCodeMap: Record<ErrorCode, ErrorCodeMeta> = {
  // 인증 관련
  [ErrorCode.AUTH_REQUIRED]: { status: 401, message: () => '로그인이 필요합니다.' },
  [ErrorCode.TOKEN_EXPIRED]: { status: 401, message: () => '토큰이 만료되었습니다.' },

  // 권한
  [ErrorCode.NO_PERMISSION]: { status: 403, message: meta => meta?.message || '권한이 없습니다.' },

  // 유저 관련
  [ErrorCode.USER_NOT_FOUND]: { status: 404, message: meta => meta?.message || '사용자를 찾을 수 없습니다.' },
  [ErrorCode.USER_DUPLICATE]: { status: 409, message: meta => meta?.message || '이미 존재하는 사용자입니다.' },

  // 요청 오류
  [ErrorCode.INVALID_INPUT]: {
    status: 400,
    message: meta => meta?.message || '입력값이 유효하지 않습니다.',
  },
  [ErrorCode.DATA_NOT_FOUND]: { status: 404, message: meta => meta?.message || '데이터를 찾을 수 없습니다.' },
  [ErrorCode.NOT_FOUND]: { status: 404, message: meta => meta?.message || '요청한 리소스를 찾을 수 없습니다.' },
  [ErrorCode.VALIDATION_ERROR]: {
    status: 400,
    message: meta => (meta?.details ? `입력값이 유효하지 않습니다. (${meta.details})` : '입력값이 유효하지 않습니다.'),
  },

  // AI 관련
  [ErrorCode.AI_KEY_REQUIRED]: { status: 400, message: () => 'AI 키가 입력되지 않았습니다.' },
  [ErrorCode.AI_KEY_INVALID]: {
    status: 401,
    message: meta => {
      let msg = 'AI 키가 유효하지 않습니다.'
      if (meta?.reason) msg += ` (${meta.reason}`
      if (meta?.length !== undefined) msg += `, 입력 길이: ${meta.length}`
      if (meta?.detail) msg += `, 상세: ${meta.detail}`
      if (msg.endsWith('(')) msg = msg.slice(0, -1)
      else if (msg.includes('(')) msg += ')'
      return msg
    },
  },
  [ErrorCode.AI_NO_PERMISSION]: { status: 403, message: () => 'AI 키에 필요한 권한이 없습니다.' },
  [ErrorCode.AI_API_ERROR]: {
    status: 502,
    message: meta =>
      `AI API 호출 중 오류가 발생했습니다.${meta?.provider ? ` (provider: ${meta.provider})` : ''}${meta?.message ? `: ${meta.message}` : ''}`,
  },
  [ErrorCode.INVALID_CLIENT_CREDENTIALS]: {
    status: 401,
    message: () => '클라이언트 ID 또는 시크릿이 잘못되었습니다.',
  },
  [ErrorCode.AI_PROVIDER_NOT_SUPPORTED]: { status: 400, message: () => '지원하지 않는 AI 제공자입니다.' },

  // 외부 API
  [ErrorCode.EXTERNAL_API_FAIL]: { status: 502, message: meta => meta?.message || '외부 API 호출 실패' },
  [ErrorCode.EXTERNAL_API_NO_RESPONSE]: { status: 504, message: meta => meta?.message || '외부 API 응답이 없습니다.' },
  [ErrorCode.EXTERNAL_API_PARSE_ERROR]: { status: 502, message: meta => meta?.message || '외부 API 응답 파싱 오류' },

  // GCS/스토리지
  [ErrorCode.GCS_CONFIG_REQUIRED]: { status: 400, message: meta => meta?.message || 'GCS 설정이 완료되지 않았습니다.' },
  [ErrorCode.GCS_JSON_PARSE_ERROR]: {
    status: 400,
    message: meta => meta?.message || 'GCS 서비스 계정 키 JSON 형식이 올바르지 않습니다.',
  },
  [ErrorCode.GCS_UPLOAD_FAIL]: { status: 500, message: meta => meta?.message || 'GCS 이미지 업로드에 실패했습니다.' },
  [ErrorCode.GCS_PUBLIC_URL_FAIL]: {
    status: 500,
    message: meta => meta?.message || 'GCS 공개 URL 생성에 실패했습니다.',
  },
  [ErrorCode.GCS_IMAGE_DELETE_FAIL]: {
    status: 500,
    message: meta => meta?.message || 'GCS 이미지 삭제에 실패했습니다.',
  },
  [ErrorCode.GCS_BUCKET_CREATE_FAIL]: {
    status: 500,
    message: meta => meta?.message || 'GCS 버킷 생성/권한 부여에 실패했습니다.',
  },
  [ErrorCode.GCS_CONNECTION_FAIL]: { status: 500, message: meta => meta?.message || 'GCS 연결에 실패했습니다.' },

  // 서버/기타
  [ErrorCode.INTERNAL_ERROR]: { status: 500, message: meta => meta?.message || '서버 내부 오류' },

  // Pixabay API
  [ErrorCode.PIXABAY_API_KEY_REQUIRED]: { status: 400, message: () => 'Pixabay API 키가 입력되지 않았습니다.' },
  [ErrorCode.PIXABAY_IMAGE_NOT_FOUND]: { status: 404, message: () => '모든 키워드에 대해 이미지를 찾을 수 없습니다.' },

  // Perplexity API
  [ErrorCode.PERPLEXITY_API_KEY_REQUIRED]: { status: 400, message: () => 'Perplexity API 키가 입력되지 않았습니다.' },

  // Gemini API
  [ErrorCode.GEMINI_API_KEY_REQUIRED]: { status: 400, message: () => 'Gemini API 키가 입력되지 않았습니다.' },
  [ErrorCode.AI_QUOTA_EXCEEDED]: {
    status: 429,
    message: meta =>
      `API 할당량이 초과되었습니다.${meta?.retryDelay ? ` ${meta.retryDelay}초 후에 다시 시도해주세요.` : ''}${meta?.provider ? ` (provider: ${meta.provider})` : ''}`,
  },

  // 작업 관련
  [ErrorCode.JOB_NOT_FOUND]: { status: 404, message: meta => meta?.message || '작업을 찾을 수 없습니다.' },
  [ErrorCode.JOB_ID_REQUIRED]: { status: 400, message: meta => meta?.message || '작업 ID가 제공되지 않았습니다.' },
  [ErrorCode.JOB_ALREADY_PROCESSING]: { status: 409, message: meta => meta?.message || '처리 중인 작업입니다.' },
  [ErrorCode.JOB_BULK_RETRY_FAILED]: { status: 500, message: meta => meta?.message || '벌크 재시도에 실패했습니다.' },
  [ErrorCode.JOB_BULK_DELETE_FAILED]: { status: 500, message: meta => meta?.message || '벌크 삭제에 실패했습니다.' },
  [ErrorCode.JOB_DELETE_PROCESSING]: {
    status: 400,
    message: meta => meta?.message || '처리 중인 작업은 삭제할 수 없습니다.',
  },
  [ErrorCode.JOB_LOG_FETCH_FAILED]: {
    status: 500,
    message: meta => meta?.message || '작업 로그를 가져오는데 실패했습니다.',
  },
  [ErrorCode.JOB_RETRY_FAILED]: { status: 500, message: meta => meta?.message || '작업 재시도에 실패했습니다.' },
  [ErrorCode.JOB_DELETE_FAILED]: { status: 500, message: meta => meta?.message || '작업 삭제에 실패했습니다.' },
  [ErrorCode.JOB_FETCH_FAILED]: {
    status: 500,
    message: meta => meta?.message || '작업 목록을 가져오는데 실패했습니다.',
  },
  [ErrorCode.BLOG_POST_JOB_NOT_FOUND]: {
    status: 404,
    message: meta => meta?.message || '블로그 포스트 작업 데이터를 찾을 수 없습니다.',
  },
  [ErrorCode.BLOGGER_BLOG_URL_REQUIRED]: { status: 400, message: meta => meta?.message || 'blogUrl이 필요합니다.' },
  [ErrorCode.TOPIC_JOB_NOT_FOUND]: {
    status: 404,
    message: meta => meta?.message || '토픽 작업 데이터를 찾을 수 없습니다.',
  },
  [ErrorCode.WORKFLOW_TOPIC_REQUIRED]: {
    status: 400,
    message: meta => meta?.message || '주제(topic) 파라미터는 필수입니다.',
  },
  [ErrorCode.WORKFLOW_EXCEL_FILE_REQUIRED]: {
    status: 400,
    message: meta => meta?.message || '엑셀 파일은 필수입니다.',
  },
  [ErrorCode.AI_IMAGE_DATA_NOT_FOUND]: {
    status: 502,
    message: meta => meta?.message || 'AI에서 이미지 데이터를 받지 못했습니다.',
  },
  [ErrorCode.SEARXNG_SEARCH_FAILED]: { status: 502, message: meta => meta?.message || 'Searxng 검색에 실패했습니다.' },
  [ErrorCode.JOB_STATUS_INVALID]: {
    status: 400,
    message: meta => `현재 상태에서는 허용되지 않은 작업입니다.${meta?.status ? ` (현재 상태: ${meta.status})` : ''}`,
  },
  [ErrorCode.JOB_STATUS_CHANGE_FAILED]: {
    status: 500,
    message: meta => meta?.message || '작업 상태 변경에 실패했습니다.',
  },

  // Blogger 관련
  [ErrorCode.BLOGGER_DEFAULT_NOT_SET]: {
    status: 400,
    message: meta => meta?.message || '기본 블로거가 설정되지 않았습니다. 설정에서 기본 블로거를 먼저 설정해주세요.',
  },
  [ErrorCode.BLOGGER_ID_NOT_FOUND]: {
    status: 400,
    message: meta =>
      meta?.message ||
      `블로거 ID "${meta?.invalidBloggerId}"가 존재하지 않습니다. 설정에서 올바른 블로거를 선택해주세요.`,
  },

  // Google OAuth 관련
  [ErrorCode.GOOGLE_OAUTH_NOT_FOUND]: {
    status: 404,
    message: meta => meta?.message || 'Google OAuth 계정을 찾을 수 없습니다.',
  },
  [ErrorCode.GOOGLE_OAUTH_DELETE_FAILED]: {
    status: 500,
    message: meta => meta?.message || 'Google OAuth 계정 삭제에 실패했습니다.',
  },
  [ErrorCode.GOOGLE_OAUTH_CREATE_FAILED]: {
    status: 500,
    message: meta => meta?.message || 'Google OAuth 계정 생성에 실패했습니다.',
  },

  // Google 블로그 관련
  [ErrorCode.GOOGLE_BLOG_NOT_FOUND]: {
    status: 404,
    message: meta => meta?.message || 'Google 블로그를 찾을 수 없습니다.',
  },
  [ErrorCode.GOOGLE_BLOG_DELETE_FAILED]: {
    status: 500,
    message: meta => meta?.message || 'Google 블로그 삭제에 실패했습니다.',
  },
  [ErrorCode.GOOGLE_BLOG_CREATE_FAILED]: {
    status: 500,
    message: meta => meta?.message || 'Google 블로그 생성에 실패했습니다.',
  },
  [ErrorCode.GOOGLE_BLOG_UPDATE_FAILED]: {
    status: 500,
    message: meta => meta?.message || 'Google 블로그 수정에 실패했습니다.',
  },
  [ErrorCode.GOOGLE_BLOG_DEFAULT_CONFLICT]: {
    status: 400,
    message: meta => meta?.message || '기본 블로그 설정에 충돌이 발생했습니다.',
  },
  [ErrorCode.GOOGLE_BLOG_NAME_DUPLICATE]: {
    status: 409,
    message: meta => meta?.message || `블로그 이름 "${meta?.name}"이 이미 존재합니다.`,
  },
  [ErrorCode.GOOGLE_BLOG_NO_DEFAULT]: {
    status: 400,
    message: meta => meta?.message || '기본 블로그가 설정되어 있지 않습니다. 최소 1개의 기본 블로그가 필요합니다.',
  },
  [ErrorCode.GOOGLE_BLOG_OAUTH_REQUIRED]: {
    status: 400,
    message: meta => meta?.message || 'Google OAuth 계정이 필요합니다.',
  },
  [ErrorCode.GOOGLE_BLOG_OAUTH_BLOGGER_DUPLICATE]: {
    status: 409,
    message: meta => meta?.message || '이미 등록된 Google OAuth 계정과 Blogger 블로그 조합입니다.',
  },

  // Tistory 관련
  [ErrorCode.TISTORY_LOGIN_FAILED]: {
    status: 401,
    message: meta => meta?.message || '티스토리 로그인에 실패했습니다.',
  },
  [ErrorCode.TISTORY_POST_FAILED]: {
    status: 500,
    message: meta => meta?.message || '티스토리 글 등록에 실패했습니다.',
  },
  [ErrorCode.TISTORY_BROWSER_LAUNCH_FAILED]: {
    status: 500,
    message: meta => meta?.message || '브라우저 실행에 실패했습니다.',
  },
  [ErrorCode.TISTORY_PAGE_NAVIGATION_FAILED]: {
    status: 500,
    message: meta => meta?.message || '페이지 이동에 실패했습니다.',
  },
  [ErrorCode.TISTORY_ELEMENT_NOT_FOUND]: {
    status: 500,
    message: meta => meta?.message || '필요한 페이지 요소를 찾을 수 없습니다.',
  },
  [ErrorCode.JOB_CREATE_FAILED]: {
    status: 500,
    message: meta => meta?.message || '작업 생성에 실패했습니다.',
  },
  [ErrorCode.JOB_UPDATE_FAILED]: {
    status: 500,
    message: meta => meta?.message || '작업 수정에 실패했습니다.',
  },
  [ErrorCode.TISTORY_DEFAULT_NOT_SET]: {
    status: 400,
    message: meta => meta?.message || '기본 티스토리 계정이 설정되지 않았습니다. 설정에서 기본 티스토리 계정을 먼저 설정해주세요.',
  },
}
