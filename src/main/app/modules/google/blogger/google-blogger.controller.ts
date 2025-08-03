import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { GoogleBloggerService } from 'src/main/app/modules/google/blogger/google-blogger.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'

@Controller('google-blogger')
export class GoogleBloggerController {
  constructor(
    private readonly bloggerService: GoogleBloggerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 기본 OAuth 계정 ID 가져오기
   */
  private async getDefaultAccountId(): Promise<string> {
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
  async getBlogPosts(@Body() options: any): Promise<any> {
    const accountId = options.accountId || (await this.getDefaultAccountId())
    const posts = await this.bloggerService.getBlogPosts(options, accountId)
    return { posts }
  }

  /**
   * 특정 게시물 조회
   */
  @Get('blogs/:blogId/posts/:postId')
  async getBlogPost(
    @Param('blogId') blogId: string,
    @Param('postId') postId: string,
    @Body() body?: { accountId?: string },
  ): Promise<any> {
    const accountId = body?.accountId || (await this.getDefaultAccountId())
    const post = await this.bloggerService.getBlogPost(blogId, postId, accountId)
    return { post }
  }

  /**
   * 블로그 정보 조회
   */
  @Get('blogs/:blogId')
  async getBlogInfo(@Param('blogId') blogId: string, @Body() body?: { accountId?: string }): Promise<any> {
    const accountId = body?.accountId || (await this.getDefaultAccountId())
    const blog = await this.bloggerService.getBlogInfo(blogId, accountId)
    return { blog }
  }

  /**
   * 블로그 URL로 블로그 정보 조회
   */
  @Post('blogs/by-url')
  async getBlogByUrl(@Body() body: { blogUrl: string; accountId?: string }): Promise<any> {
    const { blogUrl, accountId } = body

    if (!blogUrl) {
      throw new CustomHttpException(ErrorCode.BLOGGER_BLOG_URL_REQUIRED, { message: 'blogUrl이 필요합니다.' })
    }

    const finalAccountId = accountId || (await this.getDefaultAccountId())
    const blog = await this.bloggerService.getBlogByUrl(blogUrl, finalAccountId)
    return { blog }
  }

  /**
   * 사용자의 블로그 목록 조회 (기본 계정)
   */
  @Get('user/blogs')
  async getUserBlogs(@Body() body?: { accountId?: string }): Promise<any> {
    const accountId = body?.accountId || (await this.getDefaultAccountId())
    const blogs = await this.bloggerService.getUserSelfBlogs(accountId)
    return { blogs }
  }

  /**
   * 특정 OAuth 계정의 사용자 블로그 목록 조회
   */
  @Get('user/blogs/:oauthId')
  async getUserBlogsByOAuthId(@Param('oauthId') oauthId: string): Promise<any> {
    const blogs = await this.bloggerService.getUserSelfBlogsByOAuthId(oauthId)
    return { blogs }
  }

  @Post('validate-credentials')
  async validateCredentials(@Body() body: { clientId: string; clientSecret: string }) {
    return this.bloggerService.validateClientCredentials(body.clientId, body.clientSecret)
  }

  @Get('blogs')
  async getBloggerBlogs(@Body() body?: { accountId?: string }) {
    const accountId = body?.accountId || (await this.getDefaultAccountId())
    return this.bloggerService.getBloggerBlogs(accountId)
  }

  /**
   * 기본 블로그 조회
   */
  @Get('default')
  async getDefaultGoogleBlog() {
    return await this.bloggerService.getDefaultGoogleBlog()
  }

  /**
   * 특정 OAuth 계정의 기본 블로그 조회
   */
  @Get('oauth/:oauthId/default')
  async getDefaultGoogleBlogByOAuthId(@Param('oauthId') oauthId: string) {
    return await this.bloggerService.getDefaultGoogleBlogByOAuthId(oauthId)
  }
}
