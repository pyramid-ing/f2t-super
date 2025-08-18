/**
 * 입력 URL에서 protocol + host만 추출하여 반환.
 * - 좌우 공백 제거
 * - 비어있거나 유효하지 않으면 undefined 반환
 * - path/query/hash는 제거
 * - 끝 슬래시는 제거
 */
export function normalizeBaseUrl(input?: string): string | undefined {
  if (!input) return undefined
  const trimmed = input.trim()
  if (!trimmed) return undefined
  try {
    const parsed = new URL(trimmed)
    const base = `${parsed.protocol}//${parsed.host}`
    return base.replace(/\/+$/, '')
  } catch {
    // scheme 없는 경우 보정 시도 (예: example.com)
    try {
      const parsed = new URL(`https://${trimmed}`)
      const base = `${parsed.protocol}//${parsed.host}`
      return base.replace(/\/+$/, '')
    } catch {
      return undefined
    }
  }
}

/**
 * 전체 URL에서 말단 슬래시를 제거.
 * 유효하지 않거나 빈 값은 undefined 반환.
 */
export function normalizeUrl(input?: string): string | undefined {
  if (!input) return undefined
  const trimmed = input.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/\/+$/, '')
}
