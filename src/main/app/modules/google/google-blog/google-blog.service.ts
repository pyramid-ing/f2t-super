import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

const OAUTH2_CLIENT_ID = '365896770281-5jv37ff84orlj8i31arpnf9m6nbv54ch.apps.googleusercontent.com'

@Injectable()
export class GoogleBlogService {
  private readonly logger = new Logger(GoogleBlogService.name)

  constructor(private readonly prisma: PrismaService) {}

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

      // 기본 블로그로 설정하는 경우, 기존 기본 블로그 해제
      if (data.isDefault) {
        await this.prisma.bloggerAccount.updateMany({
          where: {
            googleOauthId: googleOAuth.id,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        })
      }

      // 기본 블로그가 없으면 이 블로그를 기본으로 설정
      const existingDefaultBlog = await this.prisma.bloggerAccount.findFirst({
        where: { isDefault: true },
      })

      const isDefault = data.isDefault || !existingDefaultBlog

      const googleBlog = await this.prisma.bloggerAccount.create({
        data: {
          googleOauthId: googleOAuth.id,
          bloggerBlogId: data.bloggerBlogId, // 실제 Blogger API의 블로그 ID
          bloggerBlogName: data.bloggerBlogName, // 실제 Blogger API의 블로그 ID
          name: data.name,
          desc: data.desc,
          isDefault,
        },
        include: {
          oauth: true,
        },
      })

      // 기본 블로그로 설정하는 경우, 기존 기본 블로그 해제
      if (isDefault && existingDefaultBlog) {
        await this.prisma.bloggerAccount.updateMany({
          where: {
            isDefault: true,
            id: { not: googleBlog.id },
          },
          data: {
            isDefault: false,
          },
        })
      }

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
  async updateGoogleBlog(id: number, data: { name?: string; desc?: string; isDefault?: boolean }) {
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

    // 기본 블로그를 해제하려는 경우, 다른 기본 블로그가 있는지 확인
    if (data.isDefault === false && existingBlog.isDefault) {
      const otherDefaultBlogs = await this.prisma.bloggerAccount.findMany({
        where: {
          isDefault: true,
          id: { not: id }, // 현재 블로그 제외
        },
      })

      if (otherDefaultBlogs.length === 0) {
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NO_DEFAULT, {
          message: '다른 기본 블로그가 없어서 기본 블로그를 해제할 수 없습니다. 최소 1개의 기본 블로그가 필요합니다.',
        })
      }
    }

    const updatedBlog = await this.prisma.bloggerAccount.update({
      where: { id },
      data: {
        name: data.name,
        desc: data.desc,
        isDefault: data.isDefault,
      },
      include: {
        oauth: true,
      },
    })
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
        throw new CustomHttpException(ErrorCode.GOOGLE_BLOG_NO_DEFAULT)
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
