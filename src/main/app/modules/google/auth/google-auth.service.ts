import { Injectable } from '@nestjs/common'
import { GoogleAuth } from 'google-auth-library'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class GoogleAuthService {
  constructor() {}

  public async getAuthHeaders(serviceAccountJson: string): Promise<Record<string, string>> {
    const accessToken = await this._getAccessToken(serviceAccountJson)
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  }

  private async _createGoogleAuth(serviceAccountJson: string): Promise<GoogleAuth> {
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
  }

  private async _getAccessToken(serviceAccountJson: string): Promise<string> {
    const auth = await this._createGoogleAuth(serviceAccountJson)
    const client = await auth.getClient()
    const accessTokenResponse = await client.getAccessToken()
    if (!accessTokenResponse.token) {
      throw new CustomHttpException(ErrorCode.GOOGLE_AUTH_FAIL, { errorMessage: '액세스 토큰을 가져올 수 없습니다.' })
    }
    return accessTokenResponse.token
  }
}
