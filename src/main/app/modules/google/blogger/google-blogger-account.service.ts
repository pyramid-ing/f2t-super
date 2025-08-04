import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class GoogleBloggerAccountService {
  private readonly logger = new Logger(GoogleBloggerAccountService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 기본 블로그 조회
   */
  async getDefaultGoogleBlog() {
    try {
      const defaultBlog = await this.prisma.bloggerAccount.findFirst({
        where: { isDefault: true },
        include: {
          oauth: true,
        },
      })

      if (!defaultBlog) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: '기본 블로그가 설정되어 있지 않습니다.',
        })
      }

      return defaultBlog
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `기본 블로그 조회 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * 특정 OAuth 계정의 기본 블로그 조회
   */
  async getDefaultGoogleBlogByOAuthId(oauthId: number) {
    try {
      const defaultBlog = await this.prisma.bloggerAccount.findFirst({
        where: {
          isDefault: true,
          googleOauthId: oauthId,
        },
        include: {
          oauth: true,
        },
      })

      if (!defaultBlog) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: `OAuth 계정 ${oauthId}의 기본 블로그가 설정되어 있지 않습니다.`,
          oauthId,
        })
      }

      return defaultBlog
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `기본 블로그 조회 실패: ${error.message}`,
        oauthId,
        originalError: error.message,
      })
    }
  }

  /**
   * BloggerBlogId로 BloggerAccount 조회
   */
  async getGoogleBlogByBloggerId(bloggerBlogId: string) {
    try {
      const bloggerAccount = await this.prisma.bloggerAccount.findFirst({
        where: { bloggerBlogId },
      })

      if (!bloggerAccount) {
        throw new CustomHttpException(ErrorCode.BLOGGER_ID_NOT_FOUND, {
          message: `블로거 ID "${bloggerBlogId}"가 존재하지 않습니다.`,
          invalidBloggerId: bloggerBlogId,
        })
      }

      return bloggerAccount
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `블로그 조회 실패: ${error.message}`,
        bloggerBlogId,
        originalError: error.message,
      })
    }
  }

  /**
   * OAuth 계정 조회
   */
  async getOAuthAccount(oauthId: number) {
    try {
      const oauthAccount = await this.prisma.googleOAuth.findUnique({
        where: { id: oauthId },
      })

      if (!oauthAccount) {
        throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
          message: `OAuth 계정을 찾을 수 없습니다: ${oauthId}`,
        })
      }

      return oauthAccount
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `OAuth 계정 조회 실패: ${error.message}`,
        oauthId,
        originalError: error.message,
      })
    }
  }

  /**
   * OAuth 토큰 업데이트
   */
  async updateOAuthTokens(oauthId: number, accessToken: string, expiresAt: Date) {
    try {
      await this.prisma.googleOAuth.update({
        where: { id: oauthId },
        data: {
          oauth2AccessToken: accessToken,
          oauth2TokenExpiry: expiresAt,
        },
      })
    } catch (error: any) {
      this.logger.error(`OAuth 토큰 업데이트 실패: ${oauthId}`, error)
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `OAuth 토큰 업데이트 실패: ${error.message}`,
        oauthId,
        originalError: error.message,
      })
    }
  }
}
