export enum Permission {
  // 발행 권한
  PUBLISH_TISTORY = 'publish:tistory',
  PUBLISH_WORDPRESS = 'publish:wordpress',
  PUBLISH_GOOGLE_BLOGGER = 'publish:google-blogger',

  // 사용 권한
  USE_AGODA_POSTING = 'use:agoda-posting',
  USE_COUPANG_PARTNERS = 'use:coupang-partners',
  USE_INFO_POSTING = 'use:info-posting',

  USE_INDEXING = 'use:indexing',
}

export interface LicenseInfo {
  permissions: Permission[]
  isValid: boolean
  expiresAt?: number
}

export interface RoutePermission {
  path: string
  permissions: Permission[]
  fallbackPath?: string
}
