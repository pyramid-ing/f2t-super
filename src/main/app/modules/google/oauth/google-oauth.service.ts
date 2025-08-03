import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '../../settings/settings.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

const OAUTH2_CLIENT_ID = '365896770281-rrr9tqujl2qvgsl2srdl8ccjse9dp86t.apps.googleusercontent.com'
const OAUTH2_CLIENT_SECRET = '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'

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name)

  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 저장된 Google OAuth 토큰 가져오기
   * @param googleOAuthId 계정 ID (필수)
   */
  async getAccessToken(googleOAuthId: string): Promise<string> {
    // 특정 계정 ID로 계정 조회
    const googleOAuth = await this.prisma.googleOAuth.findUnique({
      where: { id: googleOAuthId },
    })

    if (!googleOAuth) {
      throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, {
        message: `Google OAuth 계정 ID ${googleOAuthId}를 찾을 수 없습니다.`,
      })
    }

    // 토큰 만료 확인
    const expiryTime = googleOAuth.oauth2TokenExpiry.getTime()
    const isExpired = Date.now() >= expiryTime - 60000 // 1분 여유

    if (isExpired && googleOAuth.oauth2RefreshToken) {
      this.logger.log('Google 토큰 만료 감지, 자동 갱신 시도...')
      try {
        const newTokens = await this.refreshAccessToken(
          googleOAuth.oauth2RefreshToken,
          googleOAuth.oauth2ClientId,
          googleOAuth.oauth2ClientSecret,
        )

        // DB 업데이트
        await this.prisma.googleOAuth.update({
          where: { id: googleOAuth.id },
          data: {
            oauth2AccessToken: newTokens.accessToken,
            oauth2TokenExpiry: new Date(newTokens.expiresAt),
          },
        })

        this.logger.log('Google 토큰이 자동으로 갱신되었습니다.')
        return newTokens.accessToken
      } catch (refreshError: any) {
        throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
          message: `Google 토큰 갱신 실패: ${refreshError.message}. 다시 로그인해주세요.`,
          originalError: refreshError.message,
        })
      }
    }

    return googleOAuth.oauth2AccessToken
  }

  /**
   * Refresh Token으로 Access Token 갱신
   */
  async refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
          message: errorData.error_description || 'Token 갱신 실패',
          httpStatus: response.status,
          errorData,
        })
      }

      const data = await response.json()
      return {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      }
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `토큰 갱신 중 네트워크 오류: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * OAuth 콜백 처리 및 GoogleOAuth DB에 새로운 계정 추가
   */
  async processOAuthCallback(code: string) {
    try {
      const settings = await this.settingsService.getSettings()
      if (!settings) {
        throw new CustomHttpException(ErrorCode.INVALID_INPUT, {
          message: 'Google 설정이 존재하지 않습니다.',
          configType: 'global_settings',
        })
      }

      // 토큰 교환
      const tokens = await this.exchangeCodeForTokens(code, OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET)

      // 사용자 정보 조회
      const userInfo = await this.getGoogleUserInfo(tokens.accessToken)

      // 이메일 기준으로 upsert (이미 존재하면 업데이트, 없으면 생성)
      const googleOAuth = await this.prisma.googleOAuth.upsert({
        where: { email: userInfo.email },
        update: {
          oauth2ClientId: OAUTH2_CLIENT_ID,
          oauth2ClientSecret: OAUTH2_CLIENT_SECRET,
          oauth2AccessToken: tokens.accessToken,
          oauth2RefreshToken: tokens.refreshToken,
          oauth2TokenExpiry: new Date(tokens.expiresAt),
          name: `${userInfo.name || userInfo.email}의 계정`,
          desc: `Google OAuth 계정 - ${userInfo.email}`,
          updatedAt: new Date(),
        },
        create: {
          oauth2ClientId: OAUTH2_CLIENT_ID,
          oauth2ClientSecret: OAUTH2_CLIENT_SECRET,
          oauth2AccessToken: tokens.accessToken,
          oauth2RefreshToken: tokens.refreshToken,
          oauth2TokenExpiry: new Date(tokens.expiresAt),
          email: userInfo.email,
          name: `${userInfo.name || userInfo.email}의 계정`,
          desc: `Google OAuth 계정 - ${userInfo.email}`,
        },
      })

      this.logger.log(`GoogleOAuth DB에 새로운 계정 추가 완료: ${googleOAuth.id}`)

      return {
        tokens,
        userInfo,
        googleOAuthId: googleOAuth.id,
      }
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `OAuth 콜백 처리 실패: ${error.message}`,
        hasCode: !!code,
        originalError: error.message,
      })
    }
  }

  /**
   * 인증 코드로 토큰 교환
   */
  async exchangeCodeForTokens(code: string, clientId: string, clientSecret: string) {
    try {
      const requestBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost:3554/google-oauth/callback',
      })
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody,
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
          message: `토큰 교환 실패: ${errorData.error_description || errorData.error}`,
          httpStatus: response.status,
          errorData,
        })
      }
      const data = await response.json()
      if (!data.access_token) {
        throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
          message: 'Google에서 유효한 액세스 토큰을 받지 못했습니다.',
          responseData: data,
        })
      }
      this.logger.log('Google 토큰 교환 성공')
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
      }
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `토큰 교환 중 네트워크 오류: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * 액세스 토큰으로 사용자 정보 조회
   */
  async getGoogleUserInfo(accessToken: string) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!response.ok) {
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: '사용자 정보 조회 실패',
        httpStatus: response.status,
      })
    }
    return await response.json()
  }

  /**
   * 토큰 갱신
   * @param accountId 계정 ID (필수)
   */
  async refreshToken(accountId: string) {
    try {
      // 특정 계정 ID로 계정 조회
      const googleOAuth = await this.prisma.googleOAuth.findUnique({
        where: { id: accountId },
      })

      if (!googleOAuth || !googleOAuth.oauth2RefreshToken) {
        throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, {
          message: `Refresh token이 없거나 계정 ID ${accountId}를 찾을 수 없습니다.`,
        })
      }

      const newTokens = await this.refreshAccessToken(
        googleOAuth.oauth2RefreshToken,
        googleOAuth.oauth2ClientId,
        googleOAuth.oauth2ClientSecret,
      )

      // DB 업데이트
      await this.prisma.googleOAuth.update({
        where: { id: googleOAuth.id },
        data: {
          oauth2AccessToken: newTokens.accessToken,
          oauth2TokenExpiry: new Date(newTokens.expiresAt),
        },
      })

      return {
        success: true,
        message: '토큰이 성공적으로 갱신되었습니다.',
        accessToken: newTokens.accessToken,
      }
    } catch (error: any) {
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `토큰 갱신 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * 현재 OAuth 상태 확인
   * @param accountId 계정 ID (필수)
   */
  async getOAuthStatus(accountId: string) {
    try {
      // 특정 계정 ID로 계정 조회
      const googleOAuth = await this.prisma.googleOAuth.findUnique({
        where: { id: accountId },
      })

      if (!googleOAuth) {
        return {
          isLoggedIn: false,
          message: `Google OAuth 계정 ID ${accountId}를 찾을 수 없습니다.`,
        }
      }

      // 토큰 만료 확인
      const expiryTime = googleOAuth.oauth2TokenExpiry.getTime()
      const isExpired = Date.now() >= expiryTime - 60000 // 1분 여유

      if (isExpired && googleOAuth.oauth2RefreshToken) {
        // 자동으로 토큰 갱신 시도
        try {
          await this.refreshToken(accountId)
          const updatedOAuth = await this.prisma.googleOAuth.findUnique({
            where: { id: accountId },
          })
          const userInfo = await this.getGoogleUserInfo(updatedOAuth!.oauth2AccessToken)
          return {
            isLoggedIn: true,
            userInfo,
            message: '토큰이 자동으로 갱신되었습니다.',
          }
        } catch (error) {
          return {
            isLoggedIn: false,
            message: '토큰 갱신 실패. 다시 로그인해주세요.',
          }
        }
      }

      // 유효한 토큰으로 사용자 정보 가져오기
      const userInfo = await this.getGoogleUserInfo(googleOAuth.oauth2AccessToken)
      return {
        isLoggedIn: true,
        userInfo,
        message: '로그인 상태입니다.',
      }
    } catch (error: any) {
      return {
        isLoggedIn: false,
        message: '로그인 상태 확인 실패.',
        error: error.message,
      }
    }
  }

  /**
   * 로그아웃 (GoogleOAuth DB에서 계정 삭제)
   */
  async logout() {
    try {
      // GoogleOAuth DB에서 모든 계정 삭제
      await this.prisma.googleOAuth.deleteMany()

      return {
        success: true,
        message: 'Google 계정 연동이 해제되었습니다.',
      }
    } catch (error: any) {
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `로그아웃 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * OAuth 계정 목록 조회
   */
  async getOAuthAccounts() {
    try {
      const accounts = await this.prisma.googleOAuth.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          desc: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return accounts
    } catch (error: any) {
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `OAuth 계정 목록 조회 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * 특정 OAuth 계정 삭제
   */
  async deleteOAuthAccount(accountId: string) {
    try {
      await this.prisma.googleOAuth.delete({
        where: { id: accountId },
      })

      return { success: true, message: 'OAuth 계정이 삭제되었습니다.' }
    } catch (error: any) {
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `OAuth 계정 삭제 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * 클라이언트 ID/시크릿 유효성 검증
   */
  async validateClientCredentials(clientId: string, clientSecret: string) {
    // 임의의 잘못된 code로 토큰 요청을 시도하여 clientId/clientSecret 유효성만 체크
    const fakeCode = 'invalid_code_for_validation'
    const requestBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: fakeCode,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:3554/google-oauth/callback',
    })

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    })
    const data = await response.json()
    // clientId/clientSecret이 잘못된 경우 error: 'unauthorized_client' 또는 'invalid_client' 등 반환
    if (data.error === 'unauthorized_client' || data.error === 'invalid_client') {
      throw new CustomHttpException(ErrorCode.INVALID_CLIENT_CREDENTIALS, {
        message: '클라이언트 ID 또는 시크릿이 잘못되었습니다.',
        responseData: data,
      })
    }
    // code가 잘못된 경우 error: 'invalid_grant' 등 반환 → 이 경우는 clientId/secret이 맞다는 의미
    if (data.error === 'invalid_grant') {
      return { valid: true }
    }
  }
}
