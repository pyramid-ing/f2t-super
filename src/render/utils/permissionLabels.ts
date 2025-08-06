import { Permission } from '@render/types/permissions'

export const permissionLabels: Record<Permission, string> = {
  [Permission.PUBLISH_TISTORY]: '티스토리 발행',
  [Permission.PUBLISH_WORDPRESS]: '워드프레스 발행',
  [Permission.PUBLISH_GOOGLE_BLOGGER]: '구글 블로그스팟 발행',
  [Permission.USE_COUPANG_PARTNERS]: '쿠팡 파트너스 사용',
  [Permission.USE_INFO_POSTING]: '정보 블로그 사용',
}

export const getPermissionLabel = (permission: Permission): string => {
  return permissionLabels[permission] || permission
}

export const getPermissionLabels = (permissions: Permission[]): string[] => {
  return permissions.map(getPermissionLabel)
}
