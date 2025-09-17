import { Injectable, Logger } from '@nestjs/common'
import { Storage } from '@google-cloud/storage'
import { SettingsService } from '../../settings/settings.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

export interface StorageUploadOptions {
  fileName?: string
  contentType?: string
  isPublic?: boolean
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  constructor(private readonly settingsService: SettingsService) {}

  public async uploadImage(
    imageBuffer: Buffer,
    options: StorageUploadOptions = {},
  ): Promise<{ url: string; fileName: string }> {
    const { fileName, contentType = 'image/png', isPublic = true } = options

    try {
      const storage = await this._initializeStorage()
      const settings = await this.settingsService.getSettings()
      const bucket = storage.bucket(settings.gcsBucketName)

      // 파일명 생성 (제공되지 않은 경우 자동 생성)
      const finalFileName = fileName
      const file = bucket.file(finalFileName)

      // 업로드 스트림 생성 (Uniform bucket-level access 호환)
      const stream = file.createWriteStream({
        metadata: {
          contentType,
          cacheControl: 'public, max-age=86400', // 1일 캐시
        },
        validation: 'md5',
      })

      return new Promise((resolve, reject) => {
        stream.on('error', error => {
          this.logger.error('GCS 업로드 실패:', error)
          reject(
            new CustomHttpException(ErrorCode.GCS_UPLOAD_FAIL, { message: `이미지 업로드 실패: ${error.message}` }),
          )
        })

        stream.on('finish', async () => {
          try {
            // 항상 공개 URL 사용 (블로그 이미지용)
            const publicUrl = `https://storage.googleapis.com/${settings.gcsBucketName}/${finalFileName}`

            // 파일을 공개로 설정
            try {
              await file.makePublic()
              this.logger.log(`파일 공개 설정 완료: ${finalFileName}`)
            } catch (makePublicError) {
              this.logger.warn(`파일 공개 설정 실패 (버킷이 이미 공개이거나 권한 부족): ${makePublicError.message}`)
              // 실패해도 계속 진행 (버킷이 이미 공개일 수 있음)
            }

            this.logger.log(`이미지 업로드 성공: ${publicUrl}`)
            resolve({
              url: publicUrl,
              fileName: finalFileName,
            })
          } catch (error) {
            this.logger.error('공개 URL 생성 실패:', error)
            reject(
              new CustomHttpException(ErrorCode.GCS_PUBLIC_URL_FAIL, {
                message: `공개 URL 생성 실패: ${error.message}`,
              }),
            )
          }
        })

        // 버퍼 데이터를 스트림에 쓰기
        stream.end(imageBuffer)
      })
    } catch (error) {
      this.logger.error('GCS 업로드 중 오류:', error)
      throw error
    }
  }

  private async _initializeStorage(): Promise<Storage> {
    const settings = await this.settingsService.getSettings()

    if (!settings.gcsKeyContent) {
      throw new CustomHttpException(ErrorCode.GCS_CONFIG_REQUIRED)
    }

    try {
      // JSON 문자열을 파싱하여 자격 증명으로 사용
      const credentials = JSON.parse(settings.gcsKeyContent)

      return new Storage({
        credentials,
        projectId: credentials.project_id,
      })
    } catch (error) {
      this.logger.error('GCS 초기화 실패:', error)
      if (error instanceof SyntaxError) {
        throw new CustomHttpException(ErrorCode.GCS_JSON_PARSE_ERROR)
      }
      throw new CustomHttpException(ErrorCode.INTERNAL_ERROR, { message: `GCS 초기화 실패: ${error.message}` })
    }
  }

  /**
   * 버킷을 생성하고 settings.gcsBucketName에 저장
   */
  public async createAndSetBucket(bucketName: string): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const storage = await this._initializeStorage()
    const [bucketExists] = await storage.bucket(bucketName).exists()
    if (!bucketExists) {
      await storage.createBucket(bucketName, {
        location: 'asia-northeast3',
        storageClass: 'STANDARD',
        uniformBucketLevelAccess: true,
      })
      await storage.bucket(bucketName).iam.setPolicy({
        bindings: [
          {
            role: 'roles/storage.objectViewer',
            members: ['allUsers'],
          },
        ],
      })
    }
    // settings에 버킷명 저장
    await this.settingsService.updateSettings({ ...settings, gcsBucketName: bucketName })
  }
}
