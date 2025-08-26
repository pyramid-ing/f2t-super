/**
 * URL 관련 유틸리티 함수들
 */

/**
 * URL에서 도메인을 추출합니다.
 * @param url 입력 URL
 * @returns 도메인 (www. 제거됨)
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    // URL이 아닌 경우 그대로 반환
    return url.replace(/^www\./, '')
  }
}

/**
 * URL을 정규화합니다. 프로토콜과 호스트만 포함하도록 합니다.
 * @param rawUrl 입력 URL
 * @returns 정규화된 URL (protocol://host 형태)
 */
export function normalizeSiteUrl(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl)
    const protocol = urlObj.protocol.replace(/:$/, '')
    const host = urlObj.host
    return `${protocol}://${host}` // 프로토콜과 도메인만 포함
  } catch {
    return rawUrl.trim()
  }
}

/**
 * URL을 정규화합니다. 프로토콜, 호스트, 경로, 쿼리를 포함하되 마지막 슬래시는 제거합니다.
 * @param rawUrl 입력 URL
 * @returns 정규화된 URL
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl)
    let protocol = urlObj.protocol.replace(/:$/, '')
    let host = urlObj.host
    let pathname = urlObj.pathname.replace(/\/$/, '')
    if (pathname === '') pathname = '/'
    return `${protocol}://${host}${pathname}${urlObj.search}`
  } catch {
    return rawUrl.trim()
  }
}

/**
 * URL에서 프로토콜과 도메인을 추출합니다.
 * @param url 입력 URL
 * @returns 프로토콜과 도메인 조합 (protocol://domain)
 */
export function extractProtocolAndDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol.replace(/:$/, '')
    const hostname = urlObj.hostname.replace(/^www\./, '')
    return `${protocol}://${hostname}`
  } catch {
    // URL이 아닌 경우 그대로 반환
    return url.replace(/^www\./, '')
  }
}
