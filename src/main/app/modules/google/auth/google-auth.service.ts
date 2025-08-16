import { Injectable } from '@nestjs/common'
import { GoogleAuth } from 'google-auth-library'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class GoogleAuthService {
  private authClient: OAuth2Client | null = null
  private indexingAPI: any = null

  constructor(private readonly settingsService: SettingsService) {}

  private async createGoogleAuth(serviceAccountJson: string): Promise<GoogleAuth> {
    try {
      if (!serviceAccountJson) {
        throw new CustomHttpException(ErrorCode.GOOGLE_SERVICE_ACCOUNT_MISSING)
      }
      let serviceAccountData
      try {
        serviceAccountData = JSON.parse(serviceAccountJson)
      } catch (error) {
        throw new CustomHttpException(ErrorCode.GOOGLE_SERVICE_ACCOUNT_MISSING, {
          errorMessage: '유효하지 않은 JSON 형식입니다.',
        })
      }
      const requiredFields = ['client_email', 'private_key', 'type']
      const missingFields = requiredFields.filter(field => !serviceAccountData[field])
      if (missingFields.length > 0) {
        throw new CustomHttpException(ErrorCode.GOOGLE_SERVICE_ACCOUNT_MISSING, {
          errorMessage: `필수 필드 누락: ${missingFields.join(', ')}`,
        })
      }
      if (serviceAccountData.type !== 'service_account') {
        throw new CustomHttpException(ErrorCode.GOOGLE_SERVICE_ACCOUNT_MISSING, {
          errorMessage: 'type이 "service_account"인지 확인해주세요.',
        })
      }
      const privateKey = serviceAccountData.private_key.replace(/\\n/g, '\n')
      return new GoogleAuth({
        credentials: {
          client_email: serviceAccountData.client_email,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/indexing'],
      })
    } catch (error) {
      throw new CustomHttpException(ErrorCode.GOOGLE_AUTH_FAIL, { errorMessage: error.message })
    }
  }

  async getAccessToken(serviceAccountJson: string): Promise<string> {
    try {
      const auth = await this.createGoogleAuth(serviceAccountJson)
      const client = await auth.getClient()
      const accessTokenResponse = await client.getAccessToken()
      if (!accessTokenResponse.token) {
        throw new CustomHttpException(ErrorCode.GOOGLE_AUTH_FAIL, { errorMessage: '액세스 토큰을 가져올 수 없습니다.' })
      }
      return accessTokenResponse.token
    } catch (error) {
      throw new CustomHttpException(ErrorCode.GOOGLE_AUTH_FAIL, { errorMessage: error.message })
    }
  }

  async getAuthHeaders(serviceAccountJson: string): Promise<Record<string, string>> {
    const accessToken = await this.getAccessToken(serviceAccountJson)
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  }

  async getAuthClient(): Promise<OAuth2Client> {
    if (this.authClient) {
      return this.authClient
    }
    const settings = await this.settingsService.getSettings()
    const googleSettings = settings.google
    if (!googleSettings?.credentials) {
      throw new CustomHttpException(ErrorCode.GOOGLE_AUTH_FAIL, {
        errorMessage: 'Google API 인증 정보가 설정되지 않았습니다.',
      })
    }
    const credentials = JSON.parse(googleSettings.credentials)
    this.authClient = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uris[0],
    )
    this.authClient.setCredentials({
      access_token: googleSettings.accessToken,
      refresh_token: googleSettings.refreshToken,
    })
    return this.authClient
  }

  async getIndexingAPI() {
    if (this.indexingAPI) {
      return this.indexingAPI
    }

    const auth = await this.getAuthClient()
    this.indexingAPI = google.indexing({ version: 'v3', auth })
    return this.indexingAPI
  }
}
