import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { GoogleBlogService } from './google-blog.service'
import { CreateGoogleBlogDto } from './dto/create-google-blog.dto'
import { UpdateGoogleBlogDto } from './dto/update-google-blog.dto'

@Controller('google-blog')
export class GoogleBlogController {
  constructor(private readonly googleBlogService: GoogleBlogService) {}

  /**
   * Google 블로그 목록 조회
   */
  @Get()
  async getGoogleBlogList() {
    return await this.googleBlogService.getGoogleBlogList()
  }

  /**
   * Google 블로그 조회
   */
  @Get(':id')
  async getGoogleBlog(@Param('id') id: number) {
    return await this.googleBlogService.getGoogleBlog(id)
  }

  /**
   * Google 블로그 생성
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGoogleBlog(@Body() data: CreateGoogleBlogDto) {
    return await this.googleBlogService.createGoogleBlog(data)
  }

  /**
   * Google 블로그 수정
   */
  @Put(':id')
  async updateGoogleBlog(@Param('id') id: number, @Body() data: UpdateGoogleBlogDto) {
    return await this.googleBlogService.updateGoogleBlog(id, data)
  }

  /**
   * Google 블로그 삭제 (기본 블로그 보장 포함)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGoogleBlog(@Param('id') id: number) {
    return await this.googleBlogService.deleteGoogleBlogWithDefaultProtection(id)
  }
}
