import { Injectable, Logger } from '@nestjs/common'
import type * as BloggerTypes from './google-blogger.types'
import { GoogleBloggerAccountService } from './google-blogger-account.service'
import { GoogleBloggerApiService } from './google-blogger-api.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class GoogleBloggerService {
  private readonly logger = new Logger(GoogleBloggerService.name)

  constructor(
    private readonly accountService: GoogleBloggerAccountService,
    private readonly apiService: GoogleBloggerApiService,
  ) {}

  /**
   * 블로그 URL로 블로그 정보 조회
   */
  async getBlogByUrl(blogUrl: string, googleOAuthId: string): Promise<BloggerTypes.BloggerBlog> {
    return this.apiService.getBlogByUrl(blogUrl, googleOAuthId)
  }

  /**
   * 블로그 게시물 목록 조회
   */
  async getBlogPosts(
    options: BloggerTypes.BloggerOptions,
    googleOAuthId: string,
  ): Promise<BloggerTypes.BloggerPostListResponse> {
    return this.apiService.getBlogPosts(options, googleOAuthId)
  }

  /**
   * 특정 게시물 조회
   */
  async getBlogPost(blogId: string, postId: string, googleOAuthId: string): Promise<BloggerTypes.BloggerPost> {
    return this.apiService.getBlogPost(blogId, postId, googleOAuthId)
  }

  /**
   * 블로그 정보 조회
   */
  async getBlogInfo(blogId: string, googleOAuthId: string): Promise<BloggerTypes.BloggerBlog> {
    return this.apiService.getBlogInfo(blogId, googleOAuthId)
  }

  /**
   * 사용자의 블로그 목록 조회 (기본 계정)
   */
  async getUserSelfBlogs(googleOAuthId: string): Promise<BloggerTypes.BloggerBlogListResponse> {
    return this.apiService.getUserSelfBlogs(googleOAuthId)
  }

  /**
   * 특정 OAuth 계정으로 사용자의 블로그 목록 조회
   */
  async getUserSelfBlogsByOAuthId(oauthId: string): Promise<BloggerTypes.BloggerBlogListResponse> {
    try {
      // 특정 OAuth 계정 조회
      const oauthAccount = await this.accountService.getOAuthAccount(oauthId)

      // 토큰 만료 확인 및 갱신
      const expiryTime = oauthAccount.oauth2TokenExpiry.getTime()
      const isExpired = Date.now() >= expiryTime - 60000 // 1분 여유

      let accessToken = oauthAccount.oauth2AccessToken

      if (isExpired && oauthAccount.oauth2RefreshToken) {
        try {
          // OAuth 서비스를 통해 토큰 갱신 (이 부분은 별도 구현 필요)
          // const newTokens = await this.oauthService.refreshAccessToken(...)
          // await this.accountService.updateOAuthTokens(oauthId, newTokens.accessToken, new Date(newTokens.expiresAt))
          // accessToken = newTokens.accessToken
        } catch (refreshError) {
          throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
            message: `토큰 갱신 실패: ${refreshError.message}`,
            originalError: refreshError.message,
          })
        }
      }

      return this.apiService.getUserSelfBlogsByOAuthId(oauthId, accessToken)
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `사용자 블로그 목록 조회 실패: ${error.response?.data?.error?.message || error.message}`,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
      })
    }
  }

  /**
   * Blogger API를 사용하여 블로그에 포스팅
   */
  async publish(request: Omit<BloggerTypes.BloggerPostRequest, 'blogId'>): Promise<BloggerTypes.BloggerPost> {
    const { title, content, labels, bloggerBlogId, googleOAuthId } = request

    if (!bloggerBlogId) {
      throw new CustomHttpException(ErrorCode.INVALID_INPUT, {
        message: 'bloggerBlogId가 설정되어 있지 않습니다. 설정에서 블로그를 선택하세요.',
      })
    }

    // bloggerBlogId로 GoogleBlog를 찾아서 실제 Blogger API의 blogId를 가져옴
    const googleBlog = await this.accountService.getGoogleBlogByBloggerId(bloggerBlogId)

    return this.apiService.publish(request)
  }

  /**
   * Blogger 블로그 목록 조회
   */
  async getBloggerBlogs(googleOAuthId: string) {
    return this.apiService.getBloggerBlogs(googleOAuthId)
  }

  /**
   * 클라이언트 자격 증명 검증
   */
  async validateClientCredentials(clientId: string, clientSecret: string) {
    return this.apiService.validateClientCredentials(clientId, clientSecret)
  }

  /**
   * 기본 블로그 조회
   */
  async getDefaultGoogleBlog() {
    return this.accountService.getDefaultGoogleBlog()
  }

  /**
   * 특정 OAuth 계정의 기본 블로그 조회
   */
  async getDefaultGoogleBlogByOAuthId(oauthId: string) {
    return this.accountService.getDefaultGoogleBlogByOAuthId(oauthId)
  }
}
