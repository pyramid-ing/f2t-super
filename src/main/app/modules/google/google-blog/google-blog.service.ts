import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { normalizeBaseUrl } from '@main/app/utils'

const OAUTH2_CLIENT_ID = '365896770281-5jv37ff84orlj8i31arpnf9m6nbv54ch.apps.googleusercontent.com'

@Injectable()
export class GoogleBlogService {
  private readonly logger = new Logger(GoogleBlogService.name)

  constructor(private readonly prisma: PrismaService) {}

  // deprecated: 파일 단위 유틸 제거. 공용 유틸 사용

  /**
   * Google 블로그 목록 조회
   */
  async getGoogleBlogList() {
    try {
      const blogs = await this.prisma.bloggerAccount.findMany({
        include: {
          oauth: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      return blogs
    } catch (error: any) {
      this.logger.error('Google 블로그 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 목록 조회 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * Google 블로그 생성 (OAuth 계정 ID를 받아서 해당 계정으로 블로그 생성)
   */
  async createGoogleBlog(data: {
    oauthId: number
    bloggerBlogId: string
    bloggerBlogName: string
    name: string
    desc?: string
    isDefault?: boolean
    defaultVisibility?: 'public' | 'private'
    url?: string
  }) {
    try {
      // OAuth 계정 조회
      const googleOAuth = await this.prisma.googleOAuth.findUnique({
        where: { id: data.oauthId },
      })

      if (!googleOAuth) {
        throw new CustomHttpException(ErrorCode.GOOGLE_OAUTH_NOT_FOUND, {
          message: '지정된 OAuth 계정을 찾을 수 없습니다.',
          oauthId: data.oauthId,
        })
      }

      // 블로그 이름 중복 확인
      const existingBlog = await this.prisma.bloggerAccount.findFirst({
        where: { name: data.name },
      })

      if (existingBlog) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NAME_DUPLICATE, {
          message: `블로그 이름 "${data.name}"이 이미 존재합니다.`,
          name: data.name,
        })
      }

      // URL 중복 확인 (있는 경우에만)
      if (data.url) {
        const normalizedUrl = normalizeBaseUrl(data.url)
        const existingUrlBlog = await this.prisma.bloggerAccount.findFirst({
          where: { url: normalizedUrl },
        })

        if (existingUrlBlog) {
          throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_URL_DUPLICATE, {
            message: `이미 등록된 사이트 URL입니다: ${normalizedUrl}`,
            details: {
              existingBlogName: existingUrlBlog.name,
              existingBlogId: existingUrlBlog.id,
            },
          })
        }
      }

      // 기존 계정 개수 확인 (전체 블로그스팟 계정 기준)
      const existingAccountsCount = await this.prisma.bloggerAccount.count()

      // 최초 계정이거나 isDefault가 true인 경우 기존 기본 계정을 false로 변경
      const shouldBeDefault = data.isDefault || existingAccountsCount === 0

      if (shouldBeDefault) {
        await this.prisma.bloggerAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      const googleBlog = await this.prisma.bloggerAccount.create({
        data: {
          googleOauthId: googleOAuth.id,
          bloggerBlogId: data.bloggerBlogId, // 실제 Blogger API의 블로그 ID
          bloggerBlogName: data.bloggerBlogName, // 실제 Blogger API의 블로그 ID
          name: data.name,
          desc: data.desc,
          url: normalizeBaseUrl(data.url) || undefined,
          isDefault: shouldBeDefault,
          defaultVisibility: data.defaultVisibility || 'public',
        },
        include: {
          oauth: true,
        },
      })

      return googleBlog
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }

      // Prisma 제약 조건 에러 처리
      if (
        error.code === 'P2002' &&
        error.meta?.target &&
        Array.isArray(error.meta.target) &&
        error.meta.target.includes('googleOauthId') &&
        error.meta.target.includes('bloggerBlogId')
      ) {
        // OAuth 계정 정보를 다시 조회하여 에러 메시지에 포함
        const oauthAccount = await this.prisma.googleOAuth.findFirst({
          where: { oauth2ClientId: OAUTH2_CLIENT_ID },
        })

        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_OAUTH_BLOGGER_DUPLICATE, {
          message: '이미 등록된 Google 계정과 Blogger 블로그 조합입니다. 1개만 등록가능합니다.',
          oauthId: oauthAccount?.id || 'unknown',
          bloggerBlogId: data.bloggerBlogName,
        })
      }

      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 생성 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * Google 블로그 수정
   */
  async updateGoogleBlog(id: number, data: { name?: string; desc?: string; isDefault?: boolean; url?: string }) {
    // 기존 블로그 조회
    const existingBlog = await this.prisma.bloggerAccount.findUnique({
      where: { id },
      include: { oauth: true },
    })

    if (!existingBlog) {
      throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NOT_FOUND, {
        message: '수정할 블로그를 찾을 수 없습니다.',
        blogId: id,
      })
    }

    // 이름 변경 시 중복 확인
    if (data.name && data.name !== existingBlog.name) {
      const duplicateBlog = await this.prisma.bloggerAccount.findFirst({
        where: {
          name: data.name,
          id: { not: id }, // 현재 블로그 제외
        },
      })

      if (duplicateBlog) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NAME_DUPLICATE, {
          message: `블로그 이름 "${data.name}"이 이미 존재합니다.`,
          name: data.name,
        })
      }
    }

    // URL 변경 시 중복 확인
    if (data.url && data.url !== existingBlog.url) {
      const normalizedUrl = normalizeBaseUrl(data.url)
      const duplicateUrlBlog = await this.prisma.bloggerAccount.findFirst({
        where: {
          url: normalizedUrl,
          id: { not: id }, // 현재 블로그 제외
        },
      })

      if (duplicateUrlBlog) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_URL_DUPLICATE, {
          message: `이미 등록된 사이트 URL입니다: ${normalizedUrl}`,
          details: {
            existingBlogName: duplicateUrlBlog.name,
            existingBlogId: duplicateUrlBlog.id,
          },
        })
      }
    }

    // 기본 블로그로 설정하는 경우, 기존 기본 블로그 해제
    if (data.isDefault) {
      await this.prisma.bloggerAccount.updateMany({
        where: {
          isDefault: true,
          id: { not: id }, // 현재 블로그 제외
        },
        data: {
          isDefault: false,
        },
      })
    }

    // 기본 블로그를 해제하려는 경우, 다른 블로그가 있는지 확인
    if (data.isDefault === false && existingBlog.isDefault) {
      const otherBlogs = await this.prisma.bloggerAccount.findMany({
        where: {
          id: { not: id }, // 현재 블로그 제외
        },
      })

      if (otherBlogs.length === 0) {
        throw new CustomHttpException(ErrorCode.NO_DEFAULT_ACCOUNT, {
          message: '기본 블로그 1개는 필수입니다.',
        })
      }

      // 다른 블로그 중에 이미 기본 블로그가 있는지 확인
      const existingDefaultBlog = otherBlogs.find(blog => blog.isDefault)

      // 다른 블로그 중에 기본 블로그가 없다면, 첫 번째 블로그를 기본으로 설정
      if (!existingDefaultBlog) {
        await this.prisma.bloggerAccount.update({
          where: { id: otherBlogs[0].id },
          data: { isDefault: true },
        })
      }
    }

    const toUpdate = { ...data, url: normalizeBaseUrl(data.url) }

    const updatedBlog = await this.prisma.bloggerAccount.update({
      where: { id },
      data: {
        name: data.name,
        desc: data.desc,
        isDefault: data.isDefault,
        url: toUpdate.url ?? null,
      },
      include: {
        oauth: true,
      },
    })

    // 수정 후 isDefault가 1개도 없는지 확인
    const defaultBlogsCount = await this.prisma.bloggerAccount.count({
      where: { isDefault: true },
    })

    if (defaultBlogsCount === 0) {
      throw new CustomHttpException(ErrorCode.NO_DEFAULT_ACCOUNT, {
        message: '기본 블로그 1개는 필수입니다.',
      })
    }

    return updatedBlog
  }

  /**
   * Google 블로그 삭제
   */
  async deleteGoogleBlog(id: number) {
    try {
      // 삭제할 블로그 조회
      const blogToDelete = await this.prisma.bloggerAccount.findUnique({
        where: { id },
        include: { oauth: true },
      })

      if (!blogToDelete) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NOT_FOUND, {
          message: '삭제할 블로그를 찾을 수 없습니다.',
          blogId: id,
        })
      }

      // isDefault 상관없이 삭제 가능
      await this.prisma.bloggerAccount.delete({
        where: { id },
      })
      return { success: true }
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      this.logger.error('Google 블로그 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 삭제 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

  /**
   * Google 블로그 상세 조회
   */
  async getGoogleBlog(id: number) {
    try {
      const blog = await this.prisma.bloggerAccount.findUnique({
        where: { id },
        include: {
          oauth: true,
        },
      })
      if (!blog) {
        throw new CustomHttpException(ErrorCode.NOT_FOUND, {
          message: 'Google 블로그를 찾을 수 없습니다.',
          blogId: id,
        })
      }
      return blog
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 조회 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }

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
        throw new CustomHttpException(ErrorCode.NO_DEFAULT_ACCOUNT, {
          message: '기본 블로그 1개는 필수입니다.',
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
   * 기본 블로그 보장 (최소 1개의 기본 블로그가 있도록 보장)
   */
  async ensureDefaultBlog() {
    try {
      // 기본 블로그가 있는지 확인
      const defaultBlog = await this.prisma.bloggerAccount.findFirst({
        where: { isDefault: true },
      })

      if (!defaultBlog) {
        // 기본 블로그가 없으면 첫 번째 블로그를 기본으로 설정
        const firstBlog = await this.prisma.bloggerAccount.findFirst({
          orderBy: { createdAt: 'asc' },
        })

        if (firstBlog) {
          await this.prisma.bloggerAccount.update({
            where: { id: firstBlog.id },
            data: { isDefault: true },
          })
          this.logger.log(`블로그 "${firstBlog.name}"을 기본 블로그로 자동 설정했습니다.`)
        }
      }
    } catch (error: any) {
      this.logger.error('기본 블로그 보장 중 오류 발생:', error)
    }
  }

  /**
   * 블로그 삭제 시 기본 블로그 보장
   */
  async deleteGoogleBlogWithDefaultProtection(id: number) {
    try {
      // 삭제할 블로그 조회
      const blogToDelete = await this.prisma.bloggerAccount.findUnique({
        where: { id },
        include: { oauth: true },
      })

      if (!blogToDelete) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NOT_FOUND, {
          message: '삭제할 블로그를 찾을 수 없습니다.',
          blogId: id,
        })
      }

      // 기본 블로그인지 확인
      if (blogToDelete.isDefault) {
        // 해당 OAuth 계정의 다른 블로그가 있는지 확인
        const otherBlogs = await this.prisma.bloggerAccount.findMany({
          where: {
            googleOauthId: blogToDelete.googleOauthId,
            id: { not: id },
          },
        })

        if (otherBlogs.length === 0) {
          throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NO_DEFAULT)
        }

        // 다른 블로그 중 하나를 기본으로 설정
        await this.prisma.bloggerAccount.update({
          where: { id: otherBlogs[0].id },
          data: { isDefault: true },
        })
      }

      await this.prisma.bloggerAccount.delete({
        where: { id },
      })

      // 삭제 후 기본 블로그 보장
      await this.ensureDefaultBlog()

      return { success: true }
    } catch (error: any) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      this.logger.error('Google 블로그 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.EXTERNAL_API_FAIL, {
        message: `Google 블로그 삭제 실패: ${error.message}`,
        originalError: error.message,
      })
    }
  }
}
