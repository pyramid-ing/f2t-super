/**
 * URL에서 도메인을 추출하는 함수
 * @param url - 추출할 URL
 * @returns 추출된 도메인 (www. 제거됨)
 */
export const extractDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch (error) {
    return ''
  }
}

/**
 * 도메인을 읽기 쉬운 이름으로 변환하는 함수
 * @param domain - 변환할 도메인
 * @returns 변환된 이름
 */
export const convertDomainToReadableName = (domain: string): string => {
  return domain.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * URL이 유효한지 확인하는 함수
 * @param url - 확인할 URL
 * @returns 유효성 여부
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
