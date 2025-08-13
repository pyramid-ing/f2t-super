import { api, API_BASE_URL } from './apiClient'

export const googleOAuthApi = {
  // 토큰 갱신
  refreshToken: () => api.post('/google-oauth/refresh-token').then(res => res.data),

  // OAuth 상태 확인
  getOAuthStatus: () => api.get('/google-oauth/status').then(res => res.data),

  // 로그아웃
  logout: () => api.post('/google-oauth/logout').then(res => res.data),

  // OAuth 계정 목록 조회
  getOAuthAccounts: () => api.get('/google-oauth/accounts').then(res => res.data),

  // OAuth 계정 삭제
  deleteOAuthAccount: (id: string) => api.delete(`/google-oauth/accounts/${id}`).then(res => res.data),
}

const GOOGLE_REDIRECT_URI = `${API_BASE_URL}/google-oauth/callback`
const GOOGLE_SCOPE = [
  'https://www.googleapis.com/auth/blogger',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

export function generateGoogleAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_REDIRECT_URI,
    scope: GOOGLE_SCOPE,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function getGoogleAuthStatus() {
  const response = await googleOAuthApi.getOAuthStatus()
  return response
}

export async function logoutGoogle() {
  const response = await googleOAuthApi.logout()
  return response
}

export async function isGoogleLoggedIn(): Promise<boolean> {
  const status = await getGoogleAuthStatus()
  return status.isLoggedIn || false
}

export async function getGoogleUserInfo(): Promise<any> {
  const status = await getGoogleAuthStatus()
  if (status.isLoggedIn && status.userInfo) {
    return status.userInfo
  }
  throw new Error('로그인되지 않았거나 사용자 정보가 없습니다.')
}

export function startGoogleLogin(clientId: string) {
  if (!clientId.trim()) {
    throw new Error('OAuth2 Client ID가 필요합니다.')
  }
  const authUrl = generateGoogleAuthUrl(clientId)
  window.electronAPI.openExternal(authUrl)
  return {
    success: true,
    message: '브라우저에서 Google 로그인을 완료하세요. 인증이 완료되면 자동으로 처리됩니다.',
  }
}
