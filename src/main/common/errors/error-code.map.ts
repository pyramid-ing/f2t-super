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

  // 라이센스 관련
  [ErrorCode.LICENSE_INVALID]: { status: 403, message: () => '유효하지 않은 라이센스입니다.' },
  [ErrorCode.LICENSE_EXPIRED]: { status: 403, message: () => '라이센스가 만료되었습니다.' },
  [ErrorCode.LICENSE_NOT_FOUND]: {
    status: 403,
    message: meta => meta?.message || '라이센스를 찾을 수 없습니다. 먼저 라이센스를 등록해주세요.',
  },
  [ErrorCode.LICENSE_CHECK_FAILED]: { status: 500, message: () => '라이센스 확인에 실패했습니다.' },
  [ErrorCode.LICENSE_PERMISSION_DENIED]: {
    status: 403,
    message: meta => `권한이 없습니다.${meta?.permissions ? ` (필요한 권한: ${meta.permissions.join(', ')})` : ''}`,
  },
  [ErrorCode.LICENSE_REGISTRATION_FAILED]: { status: 500, message: () => '라이센스 등록에 실패했습니다.' },
  [ErrorCode.LICENSE_ALREADY_REGISTERED]: { status: 409, message: () => '이미 등록된 라이센스입니다.' },
  [ErrorCode.LICENSE_KEY_INVALID]: { status: 400, message: () => '유효하지 않은 라이센스 키입니다.' },

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
    message: meta => {
      if (meta?.details && Array.isArray(meta.details) && meta.details.length > 0) {
        const fieldErrors = meta.details
          .map((detail: any) => {
            const messages = Array.isArray(detail.messages) ? detail.messages.join(', ') : detail.messages
            return `${detail.field}: ${messages}`
          })
          .join('; ')
        return `입력값이 유효하지 않습니다. (${fieldErrors})`
      }
      return '입력값이 유효하지 않습니다.'
    },
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
    message: meta => meta?.message || '주제(topic-job) 파라미터는 필수입니다.',
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
  [ErrorCode.GOOGLE_BLOG_URL_DUPLICATE]: {
    status: 409,
    message: meta => meta?.message || '이미 등록된 사이트 URL입니다.',
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
  [ErrorCode.TISTORY_CAPTCHA_FAILED]: {
    status: 500,
    message: meta => meta?.message || '캡챠 자동 해결에 실패했습니다.',
  },
  [ErrorCode.TISTORY_URL_DUPLICATE]: {
    status: 409,
    message: meta => meta?.message || '이미 등록된 사이트 URL입니다.',
  },
  [ErrorCode.JOB_CREATE_FAILED]: {
    status: 500,
    message: meta => meta?.message || '작업 생성에 실패했습니다.',
  },
  [ErrorCode.JOB_UPDATE_FAILED]: {
    status: 500,
    message: meta => meta?.message || '작업 수정에 실패했습니다.',
  },
  [ErrorCode.JOB_UPDATE_NO_DATA]: {
    status: 400,
    message: meta => meta?.message || '업데이트할 데이터가 제공되지 않았습니다.',
  },
  [ErrorCode.TISTORY_DEFAULT_NOT_SET]: {
    status: 400,
    message: meta =>
      meta?.message || '기본 티스토리 계정이 설정되지 않았습니다. 설정에서 기본 티스토리 계정을 먼저 설정해주세요.',
  },
  [ErrorCode.WORDPRESS_ACCOUNT_NOT_FOUND]: {
    status: 404,
    message: meta => meta?.message || '워드프레스 계정을 찾을 수 없습니다.',
  },
  [ErrorCode.WORDPRESS_POST_FAILED]: {
    status: 500,
    message: meta => meta?.message || '워드프레스 글 등록에 실패했습니다.',
  },
  [ErrorCode.WORDPRESS_URL_DUPLICATE]: {
    status: 409,
    message: meta => meta?.message || '이미 등록된 사이트 URL입니다.',
  },
  [ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED]: {
    status: 400,
    message: meta =>
      meta?.message ||
      '블로그 계정이 설정되지 않았습니다. 티스토리, 워드프레스 또는 블로그스팟 계정을 먼저 설정해주세요.',
  },
  [ErrorCode.NO_DEFAULT_ACCOUNT]: {
    status: 400,
    message: meta => meta?.message || '기본 블로그 1개는 필수입니다.',
  },
  [ErrorCode.IMAGE_UPLOAD_FAILED]: {
    status: 500,
    message: meta => meta?.message || '이미지 업로드에 실패했습니다.',
  },
  [ErrorCode.THUMBNAIL_GENERATION_FAILED]: {
    status: 500,
    message: meta => meta?.message || '썸네일 생성에 실패했습니다.',
  },
  [ErrorCode.WORKFLOW_PROCESSING_FAILED]: {
    status: 500,
    message: meta => meta?.message || '워크플로우 처리에 실패했습니다.',
  },
  [ErrorCode.WORKFLOW_VALIDATION_FAILED]: {
    status: 400,
    message: meta => meta?.message || '워크플로우 유효성 검사에 실패했습니다.',
  },

  // 쿠팡 파트너스
  [ErrorCode.COUPANG_PARTNERS_CONFIG_REQUIRED]: {
    status: 400,
    message: meta =>
      meta?.message ||
      '쿠팡 파트너스 API 키가 설정되지 않았습니다. 설정 페이지에서 API 키와 시크릿 키를 먼저 등록해주세요.',
  },
  [ErrorCode.COUPANG_PARTNERS_INVALID_URL]: {
    status: 400,
    message: meta => meta?.message || '유효하지 않은 쿠팡 상품 URL입니다. 상품 상세 페이지 URL을 입력해주세요.',
  },
  [ErrorCode.COUPANG_PARTNERS_API_ERROR]: {
    status: 502,
    message: meta => meta?.message || '쿠팡 파트너스 API 호출 중 오류가 발생했습니다.',
  },
  [ErrorCode.COUPANG_PARTNERS_LINK_FAILED]: {
    status: 500,
    message: meta => meta?.message || '쿠팡 어필리에이트 링크 생성에 실패했습니다.',
  },

  // Bing 관련
  [ErrorCode.BING_CONFIG_DISABLED]: { status: 400, message: () => 'Bing 색인이 비활성화되어 있습니다.' },
  [ErrorCode.BING_API_KEY_MISSING]: { status: 400, message: () => 'Bing API 키가 설정되지 않았습니다.' },
  [ErrorCode.BING_API_AUTH_FAIL]: {
    status: 401,
    message: () => 'Bing API 인증이 실패했습니다. API 키를 확인해주세요.',
  },
  [ErrorCode.BING_API_FORBIDDEN]: {
    status: 403,
    message: () => 'Bing API 권한이 없습니다. 사이트 등록 및 API 키 권한을 확인해주세요.',
  },
  [ErrorCode.BING_API_RATE_LIMIT]: {
    status: 429,
    message: () => 'Bing API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  },
  [ErrorCode.BING_API_INVALID_KEY]: { status: 400, message: () => 'Bing API Key가 유효하지 않습니다. (InvalidApiKey)' },
  [ErrorCode.BING_API_ERROR]: { status: 502, message: meta => `Bing API 오류: ${meta?.errorMessage || ''}` },
  [ErrorCode.BING_UNKNOWN_ERROR]: { status: 500, message: meta => `Bing 색인 요청 실패: ${meta?.errorMessage || ''}` },

  // Google 관련
  [ErrorCode.GOOGLE_CONFIG_DISABLED]: { status: 400, message: () => 'Google 색인이 비활성화되어 있습니다.' },
  [ErrorCode.GOOGLE_SERVICE_ACCOUNT_MISSING]: {
    status: 400,
    message: () => 'Google Service Account JSON이 설정되지 않았습니다.',
  },
  [ErrorCode.GOOGLE_AUTH_FAIL]: { status: 401, message: () => 'Google API 인증이 실패했습니다. 토큰을 확인해주세요.' },
  [ErrorCode.GOOGLE_API_FORBIDDEN]: {
    status: 403,
    message: () => 'Google Indexing API 권한이 없습니다. 서비스 계정 권한을 확인해주세요.',
  },
  [ErrorCode.GOOGLE_API_RATE_LIMIT]: {
    status: 429,
    message: () => 'Google API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  },
  [ErrorCode.GOOGLE_API_INVALID_KEY]: { status: 400, message: () => 'Google API Key가 유효하지 않습니다.' },
  [ErrorCode.GOOGLE_API_ERROR]: { status: 502, message: meta => `Google API 오류: ${meta?.errorMessage || ''}` },
  [ErrorCode.GOOGLE_URL_OWNERSHIP_VERIFICATION_FAILED]: {
    status: 403,
    message: () => 'URL 소유권 확인에 실패했습니다. Google Search Console에서 사이트 소유권을 확인해주세요.',
  },
  [ErrorCode.GOOGLE_UNKNOWN_ERROR]: {
    status: 500,
    message: meta => `Google 색인 요청 실패: ${meta?.errorMessage || ''}`,
  },

  // Naver 관련
  [ErrorCode.NAVER_CONFIG_DISABLED]: { status: 400, message: () => '네이버 색인이 비활성화되어 있습니다.' },
  [ErrorCode.NAVER_ACCOUNT_NOT_SELECTED]: { status: 400, message: () => '사이트에 네이버 계정이 선택되지 않았습니다.' },
  [ErrorCode.NAVER_ACCOUNT_NOT_FOUND]: { status: 404, message: () => '등록되지 않은 네이버 계정입니다.' },
  [ErrorCode.NAVER_ACCOUNT_INACTIVE]: { status: 400, message: () => '비활성화된 네이버 계정입니다.' },
  [ErrorCode.NAVER_AUTH_FAIL]: {
    status: 401,
    message: () => '네이버 인증이 실패했습니다. 쿠키 또는 계정 정보를 확인해주세요.',
  },
  [ErrorCode.NAVER_CAPTCHA_DETECTED]: {
    status: 400,
    message: () => '네이버 로그인 시 캡챠가 감지되었습니다. AI 서비스를 이용하여 자동 해제를 시도합니다.',
  },
  [ErrorCode.NAVER_CAPTCHA_SOLVE_FAILED]: {
    status: 400,
    message: () => '캡챠 해제에 실패했습니다. 수동으로 캡챠를 해제해주세요.',
  },
  [ErrorCode.NAVER_AI_SERVICE_ERROR]: {
    status: 500,
    message: meta => `AI 서비스 오류: ${meta?.errorMessage || ''}`,
  },
  [ErrorCode.NAVER_SITE_NOT_REGISTERED]: {
    status: 403,
    message: meta =>
      `네이버 서치어드바이저에 등록되지 않은 사이트입니다. 사이트: ${meta?.siteUrl || ''}. 네이버 서치어드바이저에서 해당 사이트를 등록한 후 다시 시도해주세요.`,
  },
  [ErrorCode.NAVER_UNKNOWN_ERROR]: {
    status: 500,
    message: meta => `네이버 색인 요청 실패: ${meta?.errorMessage || ''}`,
  },
  [ErrorCode.NAVER_ACCOUNT_DUPLICATE]: { status: 409, message: () => '이미 등록된 네이버 아이디입니다.' },

  // Daum 관련
  [ErrorCode.DAUM_CONFIG_DISABLED]: { status: 400, message: () => 'Daum 색인이 비활성화되어 있습니다.' },
  [ErrorCode.DAUM_AUTH_FAIL]: {
    status: 401,
    message: () => 'Daum 인증이 실패했습니다. PIN 또는 계정 정보를 확인해주세요.',
  },
  [ErrorCode.DAUM_UNKNOWN_ERROR]: { status: 500, message: meta => `Daum 색인 요청 실패: ${meta?.errorMessage || ''}` },
  [ErrorCode.DAUM_DUPLICATE_URL]: {
    status: 409,
    message: meta => `이미 등록된 URL입니다.${meta?.errorMessage ? ' (' + meta.errorMessage + ')' : ''}`,
  },
  [ErrorCode.DAUM_INVALID_URL]: { status: 400, message: meta => meta?.errorMessage || '올바르지 않은 URL입니다.' },

  // 사이트 관련
  [ErrorCode.SITE_NOT_FOUND]: { status: 404, message: () => '사이트를 찾을 수 없습니다.' },
  [ErrorCode.SITE_DOMAIN_DUPLICATE]: {
    status: 409,
    message: meta => meta?.message || '이미 존재하는 도메인입니다.',
  },
  [ErrorCode.SITE_INACTIVE]: { status: 400, message: () => '비활성화된 사이트입니다.' },
  [ErrorCode.SITE_DOMAIN_MISMATCH]: { status: 400, message: () => '도메인이 일치하지 않습니다.' },

  // IndexJob 관련
  [ErrorCode.INDEX_JOB_URL_ALREADY_REGISTERED]: {
    status: 409,
    message: meta => `이미 등록된 URL입니다: ${meta?.url || ''}`,
  },
  [ErrorCode.INDEX_JOB_ALL_ENGINES_REGISTERED]: {
    status: 409,
    message: meta => meta?.errorMessage || '이미 해당 URL에 대해 모든 검색엔진에 반영되었습니다.',
  },

  // 브라우저 관련
  [ErrorCode.CHROME_NOT_INSTALLED]: {
    status: 500,
    message: meta =>
      meta?.message ||
      '크롬 브라우저가 설치되어 있지 않습니다. https://www.google.com/chrome/ 에서 다운로드하여 설치하세요.',
  },
  [ErrorCode.CHROME_PERMISSION_DENIED]: {
    status: 500,
    message: meta =>
      meta?.message || '크롬 브라우저 실행 권한이 없습니다. 관리자 권한으로 앱을 실행하거나 크롬을 다시 설치해보세요.',
  },
  [ErrorCode.BROWSER_ERROR]: {
    status: 500,
    message: meta => meta?.message || '브라우저 실행 중 오류가 발생했습니다.',
  },
}
