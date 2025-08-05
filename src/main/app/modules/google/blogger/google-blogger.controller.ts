import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { GoogleBloggerService } from 'src/main/app/modules/google/blogger/google-blogger.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

@Controller('google-blogger')
@UseGuards(AuthGuard)
export class GoogleBloggerController {
  constructor(
    private readonly bloggerService: GoogleBloggerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 기본 OAuth 계정 ID 가져오기
   */
  private async getDefaultAccountId(): Promise<number> {
    const defaultOAuth = await this.prisma.googleOAuth.findFirst({
      orderBy: { createdAt: 'asc' },
    })

    if (!defaultOAuth) {
      throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, {
        message: 'Google OAuth 계정이 없습니다. 먼저 로그인해주세요.',
      })
    }

    return defaultOAuth.id
  }

  /**
   * 블로그 게시물 목록 조회
   */
  @Post('posts')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getBlogPosts(@Body() options: any): Promise<any> {
    const oauthId = options.oauthId || (await this.getDefaultAccountId())
    const posts = await this.bloggerService.getBlogPosts(options, oauthId)
    return { posts }
  }

  /**
   * 특정 게시물 조회
   */
  @Get('blogs/:blogId/posts/:postId')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getBlogPost(
    @Param('blogId') blogId: string,
    @Param('postId') postId: string,
    @Body() body?: { oauthId?: number },
  ): Promise<any> {
    const oauthId = body?.oauthId || (await this.getDefaultAccountId())
    const post = await this.bloggerService.getBlogPost(blogId, postId, oauthId)
    return { post }
  }

  /**
   * 블로그 정보 조회
   */
  @Get('blogs/:blogId')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getBlogInfo(@Param('blogId') blogId: string, @Body() body?: { oauthId?: number }): Promise<any> {
    const oauthId = body?.oauthId || (await this.getDefaultAccountId())
    const blog = await this.bloggerService.getBlogInfo(blogId, oauthId)
    return { blog }
  }

  /**
   * 블로그 URL로 블로그 정보 조회
   */
  @Post('blogs/by-url')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getBlogByUrl(@Body() body: { blogUrl: string; oauthId?: number }): Promise<any> {
    const { blogUrl, oauthId } = body

    if (!blogUrl) {
      throw new CustomHttpException(ErrorCode.BLOGGER_BLOG_URL_REQUIRED, { message: 'blogUrl이 필요합니다.' })
    }

    const finalAccountId = oauthId || (await this.getDefaultAccountId())
    const blog = await this.bloggerService.getBlogByUrl(blogUrl, finalAccountId)
    return { blog }
  }

  /**
   * 사용자의 블로그 목록 조회 (기본 계정)
   */
  @Get('user/blogs')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getUserBlogs(@Body() body?: { oauthId?: number }): Promise<any> {
    const oauthId = body?.oauthId || (await this.getDefaultAccountId())
    const blogs = await this.bloggerService.getUserSelfBlogs(oauthId)
    return { blogs }
  }

  /**
   * 특정 OAuth 계정의 사용자 블로그 목록 조회
   */
  @Get('user/blogs/:oauthId')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getUserBlogsByOAuthId(@Param('oauthId') oauthId: number): Promise<any> {
    const blogs = await this.bloggerService.getUserSelfBlogsByOAuthId(oauthId)
    return { blogs }
  }

  @Post('validate-credentials')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async validateCredentials(@Body() body: { clientId: string; clientSecret: string }) {
    return this.bloggerService.validateClientCredentials(body.clientId, body.clientSecret)
  }

  @Get('blogs')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getBloggerBlogs(@Body() body?: { oauthId?: number }) {
    const oauthId = body?.oauthId || (await this.getDefaultAccountId())
    return this.bloggerService.getBloggerBlogs(oauthId)
  }

  /**
   * 기본 블로그 조회
   */
  @Get('default')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getDefaultGoogleBlog() {
    return await this.bloggerService.getDefaultGoogleBlog()
  }

  /**
   * 특정 OAuth 계정의 기본 블로그 조회
   */
  @Get('oauth/:oauthId/default')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getDefaultGoogleBlogByOAuthId(@Param('oauthId') oauthId: number) {
    return await this.bloggerService.getDefaultGoogleBlogByOAuthId(oauthId)
  }

  /**
   * Blogger 계정 목록 조회
   */
  @Get('accounts')
  @Permissions(Permission.PUBLISH_GOOGLE_BLOGGER)
  async getBloggerAccounts(): Promise<any> {
    return await this.bloggerService.getBloggerAccounts()
  }
}
