import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import {
  CoupangCrawlerErrorClass,
  CoupangCrawlerService,
} from '@main/app/modules/coupang-crawler/coupang-crawler.service'
import { CoupangPartnersService } from '@main/app/modules/coupang-partners/coupang-partners.service'
import { TistoryService } from '@main/app/modules/tistory/tistory.service'
import { TistoryAutomationService } from '@main/app/modules/tistory/tistory-automation.service'
import { WordPressService } from '@main/app/modules/wordpress/wordpress.service'
import { GoogleBloggerService } from '@main/app/modules/google/blogger/google-blogger.service'
import { JobLogsService } from '@main/app/modules/job/job-logs/job-logs.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobTargetType } from '@render/api'
import { CoupangBlogJob } from '@prisma/client'
import { CoupangBlogPostJobStatus, CoupangBlogPostJobResponse } from './coupang-blog-post-job.types'
import { CreateCoupangBlogPostJobDto } from './dto/create-coupang-blog-post-job.dto'
import { UpdateCoupangBlogPostJobDto } from './dto/update-coupang-blog-post-job.dto'
import { CoupangAffiliateLink } from '@main/app/modules/coupang-partners/coupang-partners.types'
import { Type } from '@google/genai'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { JobStatus } from '@main/app/modules/job/job.types'
import { Browser, chromium, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { EnvConfig } from '@main/config/env.config'
import { CoupangProductData } from '@main/app/modules/coupang-crawler/coupang-crawler.types'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

interface BlogPostData {
  accountId: number | string
  platform: string
  title: string
  localThumbnailUrl: string
  thumbnailUrl: string
  contentHtml: string
  category?: string
  labels?: string[]
  tags: string[]
}

export interface CoupangBlogPost {
  thumbnailText?: {
    lines: string[]
  }
  title: string
  sections: {
    html: string
  }[]
  jsonLD: {
    '@type': string
    name: string
    brand: string
    image: string
    description: string
    aggregateRating: {
      '@type': string
      ratingValue: number
      reviewCount: number
    }
  }
  tags: string[]
}

@Injectable()
export class CoupangBlogPostJobService {
  private readonly logger = new Logger(CoupangBlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupangCrawler: CoupangCrawlerService,
    private readonly coupangPartners: CoupangPartnersService,
    private readonly geminiService: GeminiService,
    private readonly tistoryService: TistoryService,
    private readonly tistoryAutomationService: TistoryAutomationService,
    private readonly wordpressService: WordPressService,
    private readonly googleBloggerService: GoogleBloggerService,
    private readonly jobLogsService: JobLogsService,
  ) {}

  /**
   * 1. 쿠팡 크롤링
   */
  private async crawlCoupangProduct(coupangUrl: string): Promise<CoupangProductData> {
    try {
      // 쿠팡 상품 정보 크롤링
      const crawledData: CoupangProductData = await this.coupangCrawler.crawlProductInfo(coupangUrl)

      this.logger.log(`쿠팡 상품 크롤링 완료: ${crawledData.title}`)

      return {
        title: crawledData.title,
        price: Number(crawledData.price),
        originalUrl: coupangUrl,
        affiliateUrl: '', // 2단계에서 설정
        originImageUrls: crawledData.originImageUrls,
        images: crawledData.images,
        reviews: crawledData.reviews,
      }
    } catch (error) {
      this.logger.error('쿠팡 크롤링 실패:', error)
      if (error instanceof CoupangCrawlerErrorClass) {
        throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
          message: `쿠팡 상품 정보 크롤링에 실패했습니다: ${error.message}`,
        })
      }

      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '쿠팡 상품 정보 크롤링에 실패했습니다.',
      })
    }
  }

  /**
   * 2. 쿠팡 어필리에이트 생성
   */
  private async createAffiliateLink(coupangUrl: string): Promise<string> {
    try {
      this.logger.log(`쿠팡 어필리에이트 링크 생성 시작: ${coupangUrl}`)

      // 쿠팡 어필리에이트 링크 생성
      const affiliateData: CoupangAffiliateLink = await this.coupangPartners.createAffiliateLink(coupangUrl)

      this.logger.log(`쿠팡 어필리에이트 링크 생성 완료: ${affiliateData.shortenUrl}`)

      return affiliateData.shortenUrl
    } catch (error) {
      this.logger.error('쿠팡 어필리에이트 링크 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '쿠팡 어필리에이트 링크 생성에 실패했습니다.',
      })
    }
  }

  /**
   * 계정 설정 확인 및 플랫폼 결정
   */
  private validateBlogAccount(coupangBlogJob: CoupangBlogJob): {
    platform: 'tistory' | 'wordpress' | 'google'
    accountId: number | string
  } {
    if (coupangBlogJob.tistoryAccountId) {
      return {
        platform: 'tistory',
        accountId: coupangBlogJob.tistoryAccountId,
      }
    } else if (coupangBlogJob.wordpressAccountId) {
      return {
        platform: 'wordpress',
        accountId: coupangBlogJob.wordpressAccountId,
      }
    } else if (coupangBlogJob.bloggerAccountId) {
      return {
        platform: 'google',
        accountId: coupangBlogJob.bloggerAccountId,
      }
    } else {
      throw new CustomHttpException(ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED, {
        message: '블로그 계정이 설정되지 않았습니다. 티스토리, 워드프레스 또는 블로그스팟 계정을 먼저 설정해주세요.',
      })
    }
  }

  /**
   * 3. 이미지 업로드 (티스토리, 워드프레스, 구글 블로거)
   */
  private async uploadImages(
    imagePaths: string[],
    platform: 'tistory' | 'wordpress' | 'google',
    accountId: number | string,
  ): Promise<string[]> {
    try {
      this.logger.log(`${platform} 이미지 업로드 시작: ${imagePaths.length}개`)

      assert(imagePaths.length > 0, '업로드할 이미지가 없습니다')

      let uploadedImages: string[] = []

      switch (platform) {
        case 'tistory':
          uploadedImages = await this.tistoryService.uploadImages(accountId as number, imagePaths)
          break
        case 'wordpress':
          // 워드프레스는 개별 업로드
          for (const imagePath of imagePaths) {
            try {
              const uploadedUrl = await this.wordpressService.uploadImage(accountId as number, imagePath)
              uploadedImages.push(uploadedUrl)
              this.logger.log(`이미지 업로드 완료: ${imagePath} → ${uploadedUrl}`)
            } catch (error) {
              this.logger.error(`이미지 업로드 실패 (${imagePath}):`, error)
              throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, {
                message: `${platform} 이미지 업로드에 실패했습니다. 이미지 URL: ${imagePath}`,
              })
            }
          }
          break
        case 'google':
          // Google Blogger는 이미지 업로드를 지원하지 않으므로 원본 URL 사용
          uploadedImages = imagePaths
          break
        default:
          assert(false, `지원하지 않는 플랫폼: ${platform}`)
      }

      this.logger.log(`${platform} 이미지 업로드 완료: ${uploadedImages.length}개`)
      return uploadedImages
    } catch (error) {
      this.logger.error(`${platform} 이미지 업로드 실패:`, error)
      throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, {
        message: `${platform} 이미지 업로드에 실패했습니다.`,
      })
    }
  }

  /**
   * 썸네일 생성 (메인 이미지 + 위에 글자 생성)
   */
  private async generateThumbnail(
    thumbnailText: { lines: string[] },
    productData?: CoupangProductData,
  ): Promise<string> {
    try {
      this.logger.log('썸네일 생성 시작')

      let browser: Browser | null = null
      let page: Page | null = null

      try {
        // 브라우저 시작
        browser = await chromium.launch({
          executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
          headless: true,
        })

        page = await browser.newPage()
        await page.setViewportSize({ width: 1000, height: 1000 })

        // HTML 페이지 생성
        const html = this.generateThumbnailHTML(thumbnailText, productData)
        await page.setContent(html)

        // 스크린샷 촬영
        const screenshotPath = path.join(EnvConfig.tempDir, `thumbnail-${Date.now()}.png`)

        // temp 디렉토리가 없으면 생성
        const tempDir = path.dirname(screenshotPath)
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true })
        }

        assert(fs.existsSync(tempDir), '임시 디렉토리 생성에 실패했습니다')

        await page.screenshot({
          path: screenshotPath,
          type: 'png',
          fullPage: false,
          clip: {
            x: 0,
            y: 0,
            width: 1000,
            height: 1000,
          },
        })

        this.logger.log(`썸네일 이미지 생성 완료: ${screenshotPath}`)
        return screenshotPath
      } catch (error) {
        this.logger.error('썸네일 이미지 생성 실패:', error)
        throw new CustomHttpException(ErrorCode.THUMBNAIL_GENERATION_FAILED, {
          message: `썸네일 이미지 생성 실패: ${error.message}`,
        })
      } finally {
        if (page) {
          await page.close()
        }
      }
    } catch (error) {
      this.logger.error('썸네일 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.THUMBNAIL_GENERATION_FAILED, {
        message: '썸네일 생성에 실패했습니다.',
      })
    }
  }

  /**
   * 썸네일 HTML 생성
   */
  private generateThumbnailHTML(thumbnailText: { lines: string[] }, productData?: CoupangProductData): string {
    const lines = thumbnailText.lines.map(line => line.trim()).filter(line => line.length > 0)

    // 배경 이미지 설정
    let backgroundStyle = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);'
    if (productData && productData.images && productData.images.length > 0) {
      // 이미지를 base64로 인코딩
      const imagePath = productData.images[0]
      let base64Image = ''

      try {
        const imageBuffer = fs.readFileSync(imagePath)
        const ext = path.extname(imagePath).toLowerCase()
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
        base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`

        backgroundStyle = `
          background-image: url('${base64Image}');
          background-size: 100% 100%;
          background-position: center;
          background-repeat: no-repeat;
        `
      } catch (error) {
        this.logger.error(`이미지 로드 실패: ${imagePath}`, error)
        // 이미지 로드 실패 시 기본 그라데이션 사용
      }
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link
      href="https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap"
      rel="stylesheet"
    />
    <style>
        body {
            margin: 0;
            padding: 0;
            width: 1000px;
            height: 1000px;
            ${backgroundStyle}
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'BMDOHYEON';
            position: relative;
        }
        
        .backdrop {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.2);
            z-index: 1;
        }
        
        .thumbnail-container {
            text-align: center;
            color: white;
            padding: 40px;
            box-sizing: border-box;
            position: relative;
            z-index: 2;
        }
        
        .text-line {
            font-size: 128px;
            font-weight: 900;
            line-height: 1.2;
            margin: 10px 0;
            letter-spacing: 3px;
            color: #000000;
            text-align: center;
            text-shadow:
              -2px -2px 0 #fff,
              2px -2px 0 #fff,
              -2px 2px 0 #fff,
              2px 2px 0 #fff,
              0px -2px 0 #fff,
              0px 2px 0 #fff,
              -2px 0px 0 #fff,
              2px 0px 0 #fff;
        }
    </style>
</head>
<body>
    ${productData && productData.images && productData.images.length > 0 ? '<div class="backdrop"></div>' : ''}
    <div class="thumbnail-container">
        ${lines.map(line => `<div class="text-line">${line}</div>`).join('')}
    </div>
</body>
</html>
    `
  }

  /**
   * HTML 조합 함수 (생성된 이미지, 썸네일, 내용 등을 조합해서 html(string)로 만들기)
   */
  private combineHtmlContent({
    productData,
    platform,
    sections,
    affiliateUrl,
    jsonLD,
    thumbnailUrl,
    imageUrls,
    imageDistributionType = 'serial', // 새로운 매개변수 추가
  }: {
    productData: CoupangProductData
    sections: string[]
    imageUrls: string[]
    thumbnailUrl: string
    affiliateUrl: string
    jsonLD: {
      '@type': string
      name: string
      brand: string
      image: string
      description: string
      aggregateRating: {
        '@type': string
        ratingValue: number
        reviewCount: number
      }
    }
    platform: 'tistory' | 'wordpress' | 'google'
    imageDistributionType?: 'serial' | 'even' // 직렬형 또는 균등형
  }): string {
    this.logger.log('HTML 조합 시작')

    // 썸네일 이미지 HTML
    const thumbnailHtml =
      platform === 'tistory'
        ? `
        <div class="thumbnail-container" style="text-align: center; margin-bottom: 20px;">
          ${thumbnailUrl}
        </div>
      `
        : `
        <div class="thumbnail-container" style="text-align: center; margin-bottom: 20px;">
          <img src="${thumbnailUrl}" alt="썸네일" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
        </div>
      `

    // 이미지 배치 방식에 따른 섹션별 이미지 HTML 생성
    let sectionImagesHtml: string[]
    switch (imageDistributionType) {
      case 'serial':
        sectionImagesHtml = this.generateSerialImageDistribution(sections, imageUrls, platform)
        break
      case 'even':
        sectionImagesHtml = this.generateEvenImageDistribution(sections, imageUrls, platform)
        break
      default:
        sectionImagesHtml = this.generateSerialImageDistribution(sections, imageUrls, platform)
        break
    }

    // 구매 링크 HTML
    const affiliateHtml = `
            <div class="banner">
               <a class="banner-frame" href="${affiliateUrl}" rel="sponsored noopener" target="_blank">
               <img src="${productData.originImageUrls[0]}" alt="${productData.title}">
                <div class="banner-content">
                  <p class="banner-title">${productData.title}</p>
                  <p class="banner-p">가격 : ${productData.price.toLocaleString()}원</p>
                </div>
              </a>
              <a class="btn" href="${affiliateUrl}" rel="sponsored noopener" target="_blank">최저가 보기</a>
            </div>`

    const combinedSectionHtml = sections
      .map(
        (section, index) => `
      <div class="section" style="margin: 20px 0;">
          ${section}
          
          ${sectionImagesHtml[index] || ''}
          
          ${affiliateHtml}
      </div>
    `,
      )
      .join('')

    const coupangAnnounce = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'

    // JSON-LD 객체를 HTML 스크립트 태그로 변환
    const jsonLdScript = `<script type="application/ld+json">
${JSON.stringify(
  {
    ...jsonLD,
    // TODO 이렇게하면 <img ... 로나옴 / 나중에 src만 추출필요
    image: thumbnailUrl,
  },
  null,
  2,
)}
</script>`

    const style = `<style>
.banner {
    background-color: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0px 15px 30px 0px rgba(119, 123, 146, 0.1);
    transition: transform 0.2s;
    cursor: pointer;
    display: flex;
    align-items: center;
}

.banner-frame {
    text-decoration: none;
    display: flex
;
    align-items: center;
    width: 100%;
}

.banner img {
    width: 200px;
    height: 200px;
    margin-right: 20px;
}
.banner-content {
    flex: 1;
}
.banner-title {
    font-size: 18px;
    font-weight: bold;
    margin: 0;
}
.banner-p {
    font-size: 16px;
    margin: 0;
    color: #777;
}
.btn {
    text-decoration: none;
    background-color: #6200F4;
    box-shadow: 0px 15px 30px 0px rgba(226, 61, 226, 0.12);
    color: #fff;
    padding: 10px 30px;
    border-radius: 5px;
    font-weight: 900;
    text-align: center;
    white-space: nowrap;
    margin: 0px 10px;
}
</style> `

    // 전체 HTML 조합
    const combinedHtml = `
          ${style}
          
          ${thumbnailHtml}
          
          ${combinedSectionHtml}

          ${coupangAnnounce}
          
          ${jsonLdScript}
      `

    this.logger.log('HTML 조합 완료')
    return combinedHtml
  }

  /**
   * 직렬형 이미지 배치: 섹션당 1개씩 순서대로 배치
   */
  private generateSerialImageDistribution(
    sections: string[],
    imageUrls: string[],
    platform: 'tistory' | 'wordpress' | 'google',
  ): string[] {
    const sectionImagesHtml: string[] = []
    const maxImages = Math.min(sections.length, imageUrls.length)

    for (let i = 0; i < sections.length; i++) {
      if (i < maxImages) {
        const imageUrl = imageUrls[i]
        const imageHtml = this.generateImageHtml(imageUrl, i, platform)
        sectionImagesHtml.push(imageHtml)
      } else {
        sectionImagesHtml.push('')
      }
    }

    return sectionImagesHtml
  }

  /**
   * 균등형 이미지 배치: 처음과 끝은 고정, 중간은 랜덤 배치
   */
  private generateEvenImageDistribution(
    sections: string[],
    imageUrls: string[],
    platform: 'tistory' | 'wordpress' | 'google',
  ): string[] {
    const sectionImagesHtml: string[] = []
    const sectionCount = sections.length
    const imageCount = imageUrls.length

    if (imageCount === 0) {
      return new Array(sectionCount).fill('')
    }

    if (imageCount === 1) {
      // 이미지가 1개면 첫 번째 섹션에 배치
      const imageHtml = this.generateImageHtml(imageUrls[0], 0, platform)
      sectionImagesHtml.push(imageHtml)
      for (let i = 1; i < sectionCount; i++) {
        sectionImagesHtml.push('')
      }
      return sectionImagesHtml
    }

    if (imageCount === 2) {
      // 이미지가 2개면 첫 번째와 마지막 섹션에 배치
      const firstImageHtml = this.generateImageHtml(imageUrls[0], 0, platform)
      const lastImageHtml = this.generateImageHtml(imageUrls[1], 1, platform)

      sectionImagesHtml.push(firstImageHtml)
      for (let i = 1; i < sectionCount - 1; i++) {
        sectionImagesHtml.push('')
      }
      sectionImagesHtml.push(lastImageHtml)
      return sectionImagesHtml
    }

    // 이미지가 3개 이상인 경우
    const middleImageCount = imageCount - 2 // 첫 번째와 마지막을 제외한 이미지 수
    const middleSectionCount = sectionCount - 2 // 첫 번째와 마지막을 제외한 섹션 수

    // 첫 번째 섹션에 첫 번째 이미지 배치
    const firstImageHtml = this.generateImageHtml(imageUrls[0], 0, platform)
    sectionImagesHtml.push(firstImageHtml)

    // 중간 섹션들에 이미지 랜덤 배치
    const middleImageIndices = this.generateRandomIndices(middleImageCount, middleSectionCount)

    for (let i = 1; i < sectionCount - 1; i++) {
      const imageIndex = middleImageIndices.indexOf(i - 1)
      if (imageIndex !== -1) {
        const imageUrl = imageUrls[imageIndex + 1] // +1은 첫 번째 이미지를 제외하기 위함
        const imageHtml = this.generateImageHtml(imageUrl, imageIndex + 1, platform)
        sectionImagesHtml.push(imageHtml)
      } else {
        sectionImagesHtml.push('')
      }
    }

    // 마지막 섹션에 마지막 이미지 배치
    const lastImageHtml = this.generateImageHtml(imageUrls[imageCount - 1], imageCount - 1, platform)
    sectionImagesHtml.push(lastImageHtml)

    return sectionImagesHtml
  }

  /**
   * 이미지 HTML 생성
   */
  private generateImageHtml(imageUrl: string, index: number, platform: 'tistory' | 'wordpress' | 'google'): string {
    if (platform === 'tistory') {
      // 티스토리의 경우 placeholder 형식 사용
      return `
        <div class="product-image" style="margin: 10px 0;">
          ${imageUrl}
        </div>
      `
    } else {
      // 워드프레스, 구글 블로거의 경우 img 태그 사용
      return `
        <div class="product-image" style="margin: 10px 0;">
          <img src="${imageUrl}" alt="상품 이미지 ${index + 1}" style="max-width: 100%; height: auto; border-radius: 4px;" />
        </div>
      `
    }
  }

  /**
   * 랜덤 인덱스 생성 (균등형 배치용)
   */
  private generateRandomIndices(count: number, max: number): number[] {
    if (count >= max) {
      // 이미지가 섹션보다 많거나 같으면 모든 섹션에 배치
      return Array.from({ length: max }, (_, i) => i)
    }

    // 랜덤하게 선택
    const indices: number[] = []
    const availableIndices = Array.from({ length: max }, (_, i) => i)

    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * availableIndices.length)
      indices.push(availableIndices[randomIndex])
      availableIndices.splice(randomIndex, 1)
    }

    return indices.sort((a, b) => a - b) // 순서대로 정렬
  }

  /**
   * 5. 블로그 포스트 생성
   */

  private async generateBlogPostSections(coupangProductData: CoupangProductData): Promise<CoupangBlogPost> {
    this.logger.log(`Gemini로 블로그 콘텐츠 생성 시작`)

    const prompt = `
너는 쿠팡 파트너스로 수익을 창출하는 블로거를 위한 리뷰 작성 도우미야.
리뷰는 실제 사용자가 직접 경험한 것처럼 자연스럽고 신뢰감 있게 구성되어야 하며, 구매 유도와 클릭률을 높이는 글쓰기 방식을 적용해야 해.
사용자가 상품 리뷰를 작성할 때 아래 정보를 제공하면, 이를 바탕으로 아래 구조에 따라 1500~2000자 정도의 리뷰 콘텐츠를 작성해줘

포스팅 본문 내용만으로하고 제목은 별도로 작성해줘.

## ️ 문체 및 스타일 조건
모바일 환경에 최적화된 짧은 줄바꿈 문체를 사용해.
한 문장은 최대 2줄을 넘기지 않도록 자동 줄바꿈 처리
하나의 문단은 3줄 이내로 간결하게 유지
대화체, 공감형 문체를 사용해.
"~같아요", "~느껴지더라고요", "저만 그런 건 아니죠?", "ㅠㅠ" 등의 자연스러운 어투
감탄사, 공백 줄, 이모티콘은 최소한만 사용
사용자 입장에서 고민을 나누는 듯한 구성
"요즘 들어", "평소엔 잘 몰랐는데", "저만 그런 거 아니죠?" 같은 도입부 공감형 표현 활용
불편 → 해결 → 체감 후기 순서로 글 흐름 구성
시각적 쉬어가기 위해 필요시 빈 줄을 활용해 문단 사이 여백을 준다
단, 과도한 이모지, 색상 강조는 지양

모바일에서 자연스럽게 읽히도록 전체 글의 흐름을 끊지 않되,
한 번에 눈에 들어오는 호흡 단위로 글을 쪼개어 구성

### 예시 스타일:
<p>
요즘 들어 스마트폰을 자주 쓰다 보니
<br>
특히 밤에 불 끄고 화면만 오래 보다 보면
<br>
눈이 쉽게 따가워지더라고요.
</p>
<p>
예전엔 잘 몰랐는데
<br>
요즘은 아침에 일어나도 눈이 개운하지 않아요ㅠㅠ
</p>
<p>
그래서 인공눈물을 찾아보다가
<br>
이 제품을 알게 됐고요.
<br>
직접 써보니 생각보다 괜찮았어요.</p>

##  출력 구성 (자동 작성되는 리뷰 구조)
실제 사람들이 공감할수 있고, 실제 사용해본 사람처럼 작성해야해
문제 → 해결 → 비교 → 구매링크 흐름으로 작성할거야.
장점만 말하지말고, 단점도 내용에 있으면 말해. 하지만 장점을 더 부각해야해. 최소 장점3, 단점1.

## [JSON LD]
schema.org의 Product 타입에 맞춘 JSON-LD 스크립트를 생성해줘.

### 조건:

- \`@type\`: "Product"
- \`name\`: 제품 이름을 리뷰 본문에서 자동 추출
- \`brand\`: 브랜드명을 리뷰나 제품명에서 유추
- \`image\`: 본문 중 적절한 이미지가 없으면 임시 URL로 넣어줘
- \`description\`: 리뷰 내용을 요약해서 1~2문장 설명
- \`aggregateRating\`은 동일한 별점으로 설정 (reviewCount: 1)


이 JSON-LD는 HTML에 삽입할 스크립트 형태로 생성해줘.

##[제목 추천] – 클릭을 유도하는 강력한 타이틀
너는 클릭 유도형 제목 짓기 전문가야.
사용자가 입력한 상품 정보를 바탕으로 아래 6가지 카테고리 중 적절한 유형을 선택해

### 제목 패턴 카테고리:
1️⃣ 폭로형: "이건 진짜 사면 안 되는 제품입니다"
2️⃣ 시간 단축형: "1분 만에 효과 본 비밀 공유합니다"
3️⃣ 희소성/기간한정형: "지금 아니면 못 사요, 재고 얼마 안 남았어요"
4️⃣ 잃는 점 강조형: "이거 모르고 손해 본 사람 수두룩합니다"
5️⃣ 얻는 점 강조형: "단 1회 사용으로 체감된 차이, 꿀팁 공유합니다"
6️⃣ 혼합형: "직접 써보고 판단했습니다 – 솔직 리뷰 공개합니다"

## 🧱 HTML 구조

- \`<p>\`: 자연스러운 단락 중심 구성
- \`<h2>\`: section title (단, \`index === 1\`일 경우 제목 생략)
- \`<h3>\`: summary 소제목 1개 이상 분기
- \`<ul><li>\`: 경험적 팁이나 리스트 정리
- \`<blockquote>\`: 감성 표현 강조 (내돈내산 느낌)
- \`<table>\`: 비교, 팁, 장단점 등 정리 시 유용 (선택적)

첫 section(index === 1)은 <h2> 제목 없이 도입부처럼 써줘.

각 section은 100~300자 수준으로 작성하되, 전체 합은 1500자~2000자

[콘텐츠 아웃라인]
제목: ${coupangProductData.title}
리뷰: ${JSON.stringify(coupangProductData.reviews.positive)}`

    const gemini = await this.geminiService.getGemini()

    const resp = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 40000,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thumbnailText: {
              type: Type.OBJECT,
              properties: {
                lines: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  minItems: 1,
                  maxItems: 3,
                },
              },
              description: '썸네일이미지용 텍스트, 줄당 최대 글자수는 6자, 최대 3줄, 제목',
              required: ['lines'],
            },
            title: {
              type: Type.STRING,
              description: '해당글의 제목',
            },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  html: { type: Type.STRING },
                },
                required: ['html'],
              },
              minItems: 1,
              description: '해당 글의 단락',
            },
            jsonLD: {
              type: Type.OBJECT,
              properties: {
                '@type': { type: Type.STRING },
                name: { type: Type.STRING },
                brand: { type: Type.STRING },
                description: { type: Type.STRING },
                aggregateRating: {
                  type: Type.OBJECT,
                  properties: {
                    '@type': { type: Type.STRING },
                    ratingValue: { type: Type.NUMBER },
                    reviewCount: { type: Type.NUMBER },
                  },
                  required: ['@type', 'ratingValue', 'reviewCount'],
                },
              },
              required: ['@type', 'name', 'brand', 'description', 'aggregateRating'],
              description: '해당 포스팅의 SEO용 JSON LD/ Product 타입으로',
            },
            tags: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: `태그추천 [검색 유입 최적화를 위한 키워드 추천]
아래 기준을 반영해 블로그 유입에 효과적인 키워드 조합을 제안해줘.

상품명 + 브랜드명
기능 또는 효능 중심 키워드
사용 목적이나 대상 키워드 (자취용, 육아템, 사무용 등)
소비자가 자주 검색할 표현 (가성비, 추천, 후기 등)

# 예시:
[오프라이스딥클린세제, 냄새제거세제, 실내건조세제, 자취생추천세제, 가성비세제, 찬물세탁용]`,
            },
          },
          required: ['thumbnailText', 'sections'],
          propertyOrdering: ['thumbnailText', 'sections'],
        },
      },
    })

    const result = JSON.parse(resp.text) as CoupangBlogPost

    return result
  }

  /**
   * 6. 지정된 블로그로 발행 (티스토리, 워드프레스)
   */
  private async publishToBlog(blogPostData: BlogPostData): Promise<{ url: string }> {
    try {
      this.logger.log(`${blogPostData.platform} 블로그 발행 시작`)

      let publishedUrl: string

      switch (blogPostData.platform) {
        case 'tistory':
          const tistoryResult = await this.tistoryService.publishPost(blogPostData.accountId as number, {
            title: blogPostData.title,
            contentHtml: blogPostData.contentHtml,
            thumbnailPath: blogPostData.localThumbnailUrl,
            keywords: blogPostData.tags,
            category: blogPostData.category,
            postVisibility: 'private',
          })
          publishedUrl = tistoryResult.url
          break
        case 'wordpress':
          // 태그 getOrCreate 처리
          const tagIds: number[] = []
          if (blogPostData.tags && blogPostData.tags.length > 0) {
            for (const tagName of blogPostData.tags) {
              try {
                const tagId = await this.wordpressService.getOrCreateTag(blogPostData.accountId as number, tagName)
                tagIds.push(tagId)
              } catch (error) {
                this.logger.warn(`태그 생성 실패 (${tagName}):`, error)
                // 태그 생성 실패해도 포스트 발행은 계속 진행
              }
            }
          }

          // 카테고리 getOrCreate 처리
          let categoryIds: number[] = []
          if (blogPostData.category) {
            try {
              const categoryId = await this.wordpressService.getOrCreateCategory(
                blogPostData.accountId as number,
                blogPostData.category,
              )
              categoryIds = [categoryId]
            } catch (error) {
              this.logger.warn(`카테고리 생성 실패 (${blogPostData.category}):`, error)
              // 카테고리 생성 실패해도 포스트 발행은 계속 진행
            }
          }

          // featuredMedia 처리 - thumbnailUrl이 이미 미디어 ID인지 URL인지 확인
          let featuredMediaId: number | undefined
          if (blogPostData.thumbnailUrl) {
            const mediaId = await this.wordpressService.getMediaIdByUrl(
              blogPostData.accountId as number,
              blogPostData.thumbnailUrl,
            )
            if (mediaId) {
              featuredMediaId = mediaId
            } else {
              this.logger.warn(`미디어 ID를 찾을 수 없습니다: ${blogPostData.thumbnailUrl}`)
            }
          }

          const wordpressResult = await this.wordpressService.publishPost(blogPostData.accountId as number, {
            title: blogPostData.title,
            content: blogPostData.contentHtml,
            status: 'private',
            tags: tagIds,
            categories: categoryIds,
            featuredMediaId,
          })
          publishedUrl = wordpressResult.url
          break
        case 'google':
          // Google Blogger는 bloggerBlogId와 oauthId가 필요하므로 accountId를 bloggerAccountId로 사용
          const bloggerAccount = await this.prisma.bloggerAccount.findUnique({
            where: { id: blogPostData.accountId as number },
            include: { oauth: true },
          })

          assert(bloggerAccount, `Blogger 계정을 찾을 수 없습니다: ${blogPostData.accountId}`)

          const googleResult = await this.googleBloggerService.publish({
            title: blogPostData.title,
            content: blogPostData.contentHtml,
            bloggerBlogId: bloggerAccount.bloggerBlogId,
            oauthId: bloggerAccount.googleOauthId,
          })
          publishedUrl = googleResult.url
          break
        default:
          assert(false, `지원하지 않는 플랫폼: ${blogPostData.platform}`)
      }

      this.logger.log(`${blogPostData.platform} 블로그 발행 완료: ${publishedUrl}`)
      return { url: publishedUrl }
    } catch (error) {
      this.logger.error(`${blogPostData.platform} 블로그 발행 실패:`, error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: `${blogPostData.platform} 블로그 발행에 실패했습니다.`,
      })
    }
  }

  /**
   * 쿠팡 블로그 포스트 작업 처리 (메인 프로세스)
   */
  public async processCoupangPostJob(jobId: string): Promise<{ resultUrl?: string; resultMsg: string }> {
    try {
      this.logger.log(`쿠팡 블로그 포스트 작업 시작: ${jobId}`)
      await this.jobLogsService.log(jobId, '쿠팡 블로그 포스트 작업 시작')

      // 작업 정보 조회
      const coupangBlogJob = await this.prisma.coupangBlogJob.findUnique({
        where: { jobId },
        include: {
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      assert(coupangBlogJob, 'CoupangBlogJob not found')

      // 계정 설정 확인 및 플랫폼 결정
      const { platform, accountId } = this.validateBlogAccount(coupangBlogJob)

      // 플랫폼별 계정 사전 준비 (로그인/인증 상태 확인 및 처리)
      await this.jobLogsService.log(jobId, `${platform} 계정 사전 준비 시작`)
      await this.preparePlatformAccount(platform, accountId)
      await this.jobLogsService.log(jobId, `${platform} 계정 사전 준비 완료`)

      // 쿠팡 어필리에이트 생성
      await this.jobLogsService.log(jobId, '쿠팡 어필리에이트 링크 생성 시작')
      const affiliateUrl = await this.createAffiliateLink(coupangBlogJob.coupangUrl)
      await this.jobLogsService.log(jobId, '쿠팡 어필리에이트 링크 생성 완료')

      // 쿠팡 크롤링
      await this.jobLogsService.log(jobId, '쿠팡 상품 정보 크롤링 시작')
      const productData = await this.crawlCoupangProduct(coupangBlogJob.coupangUrl)
      productData.affiliateUrl = affiliateUrl
      await this.jobLogsService.log(jobId, '쿠팡 상품 정보 크롤링 완료')

      // 블로그 포스트 생성
      await this.jobLogsService.log(jobId, 'AI 블로그 내용 생성 시작')
      const blogPost = await this.generateBlogPostSections(productData)
      await this.jobLogsService.log(jobId, 'AI 블로그 내용 생성 완료')
      //
      // const productData = {
      //   title: '칠성사이다 제로, 210ml, 60개',
      //   price: 29400,
      //   originalUrl:
      //     'https://www.coupang.com/vp/products/4918397652?vendorItemId=85760516462&sourceType=persistentcart_widget',
      //   affiliateUrl: 'https://link.coupang.com/a/cIMxj6',
      //   originImageUrls: [
      //     'https://thumbnail10.coupangcdn.com/thumbnails/remote/1000x1000ex/image/vendor_inventory/8a3d/eeefd0bc884510b8a29651155870ac9ddfeade125d426584e18fdb95e6e3.jpg',
      //     'https://thumbnail7.coupangcdn.com/thumbnails/remote/1000x1000ex/image/retail/images/2703100638799515-9f0b0cc3-3705-4df7-8dd7-56b65723c95a.jpg',
      //     'https://thumbnail7.coupangcdn.com/thumbnails/remote/1000x1000ex/image/retail/images/2703128064598800-59b76254-a98e-4ddc-ac6f-4a6a64eef1d7.jpg',
      //   ],
      //   images: [
      //     '/Users/ironkim/WebstormProjects/f2t-super/static/temp/coupang-images/image_0.webp',
      //     '/Users/ironkim/WebstormProjects/f2t-super/static/temp/coupang-images/image_1.webp',
      //     '/Users/ironkim/WebstormProjects/f2t-super/static/temp/coupang-images/image_2.webp',
      //   ],
      //   reviews: {
      //     positive: [
      //       {
      //         author: '파닥파닥',
      //         date: '2025.07.30',
      //         content:
      //           "요즘 건강 생각해서 당 줄이려고 탄산음료 끊으려 했는데, 그게 말처럼 쉽지가 않더라고요. 단맛이 아예 없는 탄산수는 너무 밋밋하고, 일반 사이다는 당이 너무 많고… 그러다 찾게 된 게 바로 칠성사이다 제로 캔입니다. 처음엔 '제로 제품은 맛이 밍밍하지 않을까?' 하는 걱정이 있었는데, 생각보다 훨씬 괜찮았어요.일단 일반 칠성사이다랑 비교해도 맛 차이가 거의 안 나요. 톡 쏘는 청량감 그대로고, 달달한 맛도 적당히 있어서 마시는 데 거부감이 전혀 없어요. 식사 후에 한 캔 마시면 딱 좋고, 특히 고기 먹을 때 곁들이면 진짜 꿀조합이에요. 제로 제품이라 그런지 마신 후에도 텁텁한 단맛이 남지 않고 깔끔한 뒷맛도 마음에 들어요.캔 사이즈는 210ml라서 혼자 마시기 딱 좋은 양이에요. 큰 병 사두면 나중에 탄산 빠져서 버리는 일이 많았는데, 이건 그런 걱정 없이 딱 개봉해서 한 번에 마시기 좋아요. 냉장고에 몇 캔 쟁여두고 차갑게 해서 마시면 진짜 개운합니다.배송은 쿠팡답게 빠르게 잘 왔고, 포장도 깔끔했어요. 찌그러진 캔 하나 없이 정갈하게 도착했더라고요. 유통기한도 넉넉해서 오래 두고 마셔도 될 것 같아요.다만, 캔이 작다 보니 금방 마셔버려서 아쉽다는 생각이 들기도 해요. 그래서 가끔은 병 제품이나 더 큰 용량도 같이 사두고 상황에 맞게 마시고 있어요. 그래도 제로 칼로리라는 장점이 크니까, 다이어트나 혈당 조절 중인 분들한테도 부담 없이 즐길 수 있는 탄산음료로 추천드립니다.결론적으로는, 일반 칠성사이다 좋아하셨던 분들 중에서 건강 생각하시는 분들께 꼭 한번 드셔보시라고 말하고 싶어요. 맛이나 청량감이 떨어지지 않으면서도 칼로리는 0이라니, 이만한 대체품이 또 있을까요?오늘도 점심에 피자만시켜서 사이다로 잘먹었답니다",
      //         rating: 5,
      //       },
      //       {
      //         author: '헤이마맘',
      //         date: '2025.07.21',
      //         content:
      //           "요즘 날씨도 덥고 기분 전환이 필요할 때가 많아서 탄산음료를 자주 찾게 되는데, 당 섭취가 걱정되어 '제로 칼로리' 제품을 주로 선택하게 되더라고요. 그중에서도 칠성사이다 제로는 깔끔하고 청량한 맛 덕분에 냉장고에 항상 쟁여두는 필수템이 되었어요. 일반 칠성사이다와 비교해도 맛 차이가 거의 없고, 오히려 더 가볍고 깔끔하게 떨어지는 느낌이 있어요. 설탕이 들어가지 않았다고 해서 밍밍하거나 인공적인 맛이 날 줄 알았는데, 그런 느낌 없이 시원하고 상쾌한 탄산감이 살아 있어서 첫 모금부터 만족도가 높았습니다.250ml 용량이라 들고 다니기에도 부담 없고, 한 번에 마시기에 적당한 크기라 좋았어요. 특히 운동 후나 무더운 오후에 한 캔 딱 마시면 갈증도 해소되고 기분까지 리프레시 되는 느낌이에요. 다이어트 중인데 탄산이 너무 땡길 때, 칼로리에 대한 부담 없이 마실 수 있는 점도 큰 장점이에요. 제로콜라처럼 달달한 맛보다 좀 더 깔끔하고 산뜻한 맛을 선호하시는 분들께 강력 추천드려요.냉장고에 차갑게 넣어뒀다가 꺼내 마시면 정말 천국이에요. 다 마시고 나서도 입안이 개운하고, 뒷맛도 깔끔해서 기분 좋은 마무리가 됩니다. 무엇보다 칠성사이다 특유의 레몬향이 은은하게 느껴져서 상큼함까지 더해주는 느낌이라 더 자주 손이 가요. 앞으로도 제로 탄산음료 중에서는 칠성사이다 제로를 가장 선호하게 될 것 같아요. 저처럼 탄산은 좋아하지만 당이 걱정이신 분들께 꼭 한 번 마셔보시라고 추천드리고 싶습니다!",
      //         rating: 5,
      //       },
      //       {
      //         author: '콩딱이맘',
      //         date: '2025.07.20',
      //         content:
      //           '우리집 냉장고 필수템 칠성제로사이다! 맥주를 못마셔서 청량감 있는 음료를 찾다가 정착한 사이다에여 제로칼로리에 무당이라 부담없이 먹기 좋아요 오리지널 맛과 맛은 거의 동일한데 성분이 좋아서 먹게되요 강한 탄산으로 느끼한 속을 잡아줘서 좋아요 다이어트 중에 부담없이 먹기 좋아서 다음에도 또 구매할 예정입니다 제로사이다 너무 맛있어요 ㅎㅎ 추천입니다! 1. 제로 칼로리 & 무당칼로리는 0 kcal, 당류는 0 g이라 다이어트나 혈당 관리가 필요한 분들도 부담 없이 즐길 수 있어요 .설탕 대신 알룰로오스, 수크랄로스, 아세설팜칼륨 등 저칼로리 감미료를 사용합니다 .2. 오리지널 맛과 거의 동일한 청량감오리지널 칠성사이다와 거의 흡사한 첫맛과 라임 느낌 있는 단맛, 탄산의 청량감이 잘 살아 있어 "거의 똑같다"는 평이 많습니다 .특히 마신 뒤 입 안이 깔끔하고 단맛이 남지 않아 개운한 뒷맛이 특징입니다 .3. 강한 탄산기존 사이다처럼 톡쏘는 탄산감을 유지해, 시원하고 청량한 맛을 원하는 분들에게 적합합니다 4. 무첨가물 사용합성색소나 합성향료를 사용하지 않아 상대적으로 건강한 음료로 여겨집니다 .5. 제로인데도 맛은 유지제로 칼로리에 맛까지 살렸다는 롯데칠성 70년 제조 노하우가 반영된 제품입니다 ..✅ 이런 분들께 추천상황\t이유다이어트 중\t칼로리·당 걱정 없이 사이다 맛을 즐길 수 있어요혈당 관리 필요\t무당제로 혈당 걱정 덜어줍니다탁 트인 청량감 원할 때\t강한 탄산, 깔끔한 뒷맛이 매력적원조 칠성사이다 향수\t오리지널과 맛·향·탄산 거의 동일                                             칠성사이다 제로는 0칼로리·무당, 오리지널 사이다와 거의 같은 맛·강한 탄산, 깔끔한 뒷맛, 무첨가물 등으로 맛과 건강을 모두 챙기고 싶은 분들에게 좋은 선택입니다.',
      //         rating: 5,
      //       },
      //       {
      //         author: '임*숙',
      //         date: '2025.07.19',
      //         content:
      //           '칠성사이다 제로, 210ml, 30개최근 당 섭취에 신경 쓰면서도 탄산음료의 청량감을 포기하고 싶지 않아 제로 제품들을 찾다가, 이 칠성사이다 제로를 접하게 되었습니다. 처음엔 작은 210ml 캔이 30개나 있다는 구성에 먼저 마음이 갔어요. 일반적인 355ml나 500ml 캔보다 작고 가벼워서, 출근길 가방이나 운동 후 가볍게 챙기기에도 부담 없다는 점부터 매우 만족스러웠습니다.첫 모금은 기대 이상이었습니다. 기존 칠성사이다처럼 톡 쏘는 탄산과 깔끔한 라임향이 살아 있어, "이게 정말 제로 음료가 맞나?" 싶을 정도였어요. 특히 기존 제품과 거의 흡사한 청량감 덕분에 탄산 음료를 즐기던 사람도 이질감 없이 마실 수 있었습니다. 게다가 끝맛이 부담스럽지 않고 입안에 단맛이 남지 않아 개운하다는 점이 제로 제품만의 매력으로 다가왔습니다 .더불어 어떤 사용자는 "탄산이 부드럽고 람네 같은 크리미한 느낌이 난다"고 표현하던데, 저도 비슷한 경험을 했습니다. 탄산이 강렬하되 너무 거칠지 않아서 음용 후에도 부드럽게 넘어간다는 점이 인상 깊었어요.또, 0kcal 제로 제품이라는 점은 당을 걱정하는 이들에게 안심 요소입니다. 알룰로스 기반의 단맛이 쓰이긴 하지만, 마신 뒤에도 혀끝이나 목에 텁텁함이 남지 않아 좋았어요. 다이어트 중이거나 혈당에 민감한 분들에게도 좋은 선택이라고 생각됩니다.캔 하나가 210ml라 양적인 부담이 없고, 캔이 작아 한 손에 쏙 들어오는 크기라서 활동 중에도 들고 마시기 편했습니다. 각인된 유통기한을 보니 넉넉했고, 캔 용량이 작아 보관도 깔끔하게 되고, 유통과 보관에 부담이 덜했습니다.아쉬운 점도 있는데, 일부 후기에서 언급하듯 개봉 후 시간이 지나면 탄산이 조금 빨리 빠지는 느낌이 있습니다. 저는 한두 모금 남긴 상태로 두었을 때 촉감이 완전히 사라지진 않았지만, 오래 두면 탄산이 약해지는 경향은 분명 있더라고요 또, 다소 섞여 나온 알룰로스 단맛에 호불호가 갈릴 수 있습니다. 깔끔한 사이다 맛을 기대하는 사람이라면 금방 익숙해지지만, 단맛 감미료에 민감한 분들은 처음엔 어색할 수도 있겠다 싶었어요.',
      //         rating: 5,
      //       },
      //       {
      //         author: '재구매여신',
      //         date: '2025.07.12',
      //         content:
      //           '제품명 : 칠성사이다 제로 용 량 : 210ml 수 량 : 30 개칼로리 : 0 kcal구매날짜 : 2025. 04. 21배송날짜 : 2025. 04. 22--- ✅️구매동기다이어트 중이라 당분이 없는 탄산음료를 찾다가 평소 탄산음료를 즐겨 마시지만, 당류와 칼로리가 신경 쓰여 제로 칼로리 음료를 찾던 중 익숙한 브랜드의 제품이라 신뢰하고 구매하게 되었습니다. 특히 무더운 여름철, 시원한 청량감이 필요해서 선택했습니다.--- ✅️장점 ▫️오리지널과 거의 비슷한 맛: 첫 맛은 일반 칠성사이다와 구분이 어려울 정도로 상쾌해요. ▫️깔끔한 끝 맛: 일반 사이다보다 입 안에 단맛이 덜 남고 깔끔해서 좋아요. ▫️제로 칼로리 & 당류 0g: 죄책감 없이 마실 수 있어요. ▫️탄산감 충분: 톡 쏘는 느낌이 확실해서 갈증 해소에 딱이에요. ▫️작은 캔부터 대용량까지 다양한 용량: 휴대성도 좋고 상황에 맞춰 고르기 쉬워요.--- ✅️아쉬운 점 ▪️시간이 지나면 탄산이 빨리 빠지는 편이에요. 다 마시지 않으면 끝 맛이 심심해질 수 있어요. ▪️제로 특유의 인공 감미료 맛을 아주 약하게나마 느낄 수 있어요. 민감한 분들은 거슬릴 수 있어요. ▪️오렌지 등 변형 맛은 호불호가 큼: 개인적으로는 오리지널 제로가 가장 무난했어요.--- ✅️ 사용 후기 운동 후나 식사 중 탄산이 땡길 때 부담 없이 마시기 딱 좋았어요. 물 대신 마시면 안 되겠지만, 기분 전환용이나 간식 대용으로 매우 만족스러웠습니다. 특히 더운 여름철에 냉장고에 하나쯤 넣어두면 유용해요. 지금까지 마셔본 제로 탄산 중에서는 만족도 TOP3 안에 들어요.얼음을 채운 컵에 따라 마셔보니 입안 가득 시원한 청량감이 퍼지면서 갈증이 확 날아가는 느낌이었습니다. 무설탕임에도 단맛이 충분하고, 일반 사이다 못지않게 맛있었습니다.개인적으로는 치킨이나 기름진 음식과 함께 마시기에도 아주 잘 어울렸고, 식사 후 디저트처럼 마시기에도 부담이 없었습니다. 저는 매우만족 하여 재구매의사 100% 입니다!!!',
      //         rating: 5,
      //       },
      //     ],
      //   },
      // }
      //
      // const blogPost = {
      //   thumbnailText: {
      //     lines: ['칠성사이다', '제로칼로리', '당 걱정 끝!'],
      //   },
      //   sections: [
      //     {
      //       html: '<p>요즘 건강 관리 때문에<br>탄산음료 마시는 게 좀 부담스러웠어요.</p><p>시원한 게 당길 때는 많고<br>그렇다고 밍밍한 탄산수만 마시기엔<br>뭔가 아쉽더라고요.</p><p>저만 그런 건 아니죠? ㅠㅠ<br>달달하면서도 죄책감 없이 즐길 수 있는<br>그런 음료가 없을까 고민하던 중이었어요.</p><p>늘 냉장고에 시원한 탄산음료를 채워두고 싶었지만<br>쌓여가는 설탕과 칼로리 걱정에<br>마음 편히 손이 가지 않았거든요.</p><p>그러다 드디어 발견한 게 바로<br><b>칠성사이다 제로</b>였는데요.<br>솔직히 처음엔 반신반의했지만,<br>결론부터 말씀드리면,<br>이거 정말 제 삶의 질을 높여주는 물건입니다!</p>',
      //     },
      //     {
      //       html: '<h2>제로인데 이 맛이 가능하다고? 놀라운 청량감!</h2><p>사실 제로 음료는 맛이 좀 밍밍하거나<br>인공적인 단맛이 강할까 봐 걱정했거든요.<br>특유의 끝맛이 남을까 봐 망설이기도 했고요.</p><p>그런데 칠성사이다 제로는<br><b>오리지널 칠성사이다랑 맛이 거의 똑같아요!</b><br>처음 한 모금 마셨을 때 정말 놀랐어요.<br>"이게 정말 제로 음료가 맞나?" 싶을 정도였죠.</p><p>톡 쏘는 강한 탄산감도 그대로 살아있고<br>깔끔하고 상쾌한 레몬-라임 향도<br>완벽하게 재현되어 있더라고요.<br>시원하게 목을 넘어가는 그 느낌이 정말 일품이에요.</p><p>특히 마시고 난 뒤에<br>입안에 텁텁한 단맛이 남지 않고<br>정말 <b>개운하게 마무리되는 점</b>이 최고였어요.<br>이 깔끔한 뒷맛 덕분에 어떤 음식과도 잘 어울려요.</p><blockquote>"마신 뒤 입 안이 깔끔하고 단맛이 남지 않아 개운한 뒷맛이 특징입니다."<br>"오리지널과 맛·향·탄산 거의 동일"</blockquote><p>저는 특히 기름진 고기 요리나 피자 같은 음식과<br>함께 마실 때 그 진가가 발휘된다고 느껴졌어요.<br>느끼함을 싹 잡아주면서 시원한 청량감으로<br>입안을 개운하게 만들어주거든요.<br>기분 전환이 필요할 때 한 캔 마시면<br>진짜 갈증 해소에 이만한 게 없답니다!</p>',
      //     },
      //     {
      //       html: '<h3>혼자 마시기 딱 좋은 210ml, 실용성 최고!</h3><p>저는 탄산음료 큰 병 사두면<br>나중에 탄산 빠져서 버리는 일이 많았는데<br><b>210ml 캔 사이즈</b>는 그런 걱정이 없어요.</p><p>한 번에 딱 마시기 좋은 양이라<br>개봉해서 남길 일도 없고요.<br>덕분에 마지막 한 방울까지 톡 쏘는 탄산을<br>그대로 즐길 수 있다는 점이 너무 좋았어요.</p><p>냉장고에 쟁여두기도 부담 없고<br>아담한 크기라 공간도 적게 차지하고요.<br>외출할 때 가방에 쏙 넣어가기도 정말 편리하답니다.<br>운동 후에 갈증 날 때나 더운 오후에<br>가볍게 챙겨 마시기에도 딱이더라고요.</p><p>작은 캔이라 오히려 더 손이 자주 가는<br><b>매력적인 사이즈</b>라고 느껴지더라고요.<br>탄산이 빠질까 걱정할 필요 없이<br>언제든 신선하게 즐길 수 있으니 말이죠.</p>',
      //     },
      //     {
      //       html: '<h3>이젠 칼로리 걱정 없이 즐겨요! 다이어터 필수템</h3><p>칠성사이다 제로의 가장 큰 장점은<br>이름처럼 <b>0kcal에 당류도 0g</b>이라는 거예요.<br>제가 이 제품을 선택한 가장 큰 이유이기도 하죠.</p><p>다이어트 중인데 탄산이 너무 당기거나<br>평소 혈당 관리가 필요한 분들도<br>부담 없이 마음껏 즐길 수 있어서 정말 좋아요.</p><p>설탕 대신 알룰로오스, 수크랄로스 같은<br>저칼로리 감미료를 사용했지만<br>맛은 전혀 떨어지지 않는다는 게 신기해요.<br>오히려 더 깔끔하고 산뜻한 느낌이 들기도 해요.</p><p>죄책감 없이 시원한 탄산음료를<br>마실 수 있다는 점, 정말 행복하지 않나요?<br>이젠 굳이 참을 필요 없이 즐기면서<br>건강까지 챙길 수 있게 되었어요.</p><ul><li>다이어트 중에도 마음 편히! 칼로리 부담 Zero!</li><li>혈당 걱정 없이 시원하게! 건강 관리도 OK!</li><li>깔끔한 뒷맛으로 기분 전환까지!</li></ul>',
      //     },
      //     {
      //       html: '<h2>솔직히 아쉬웠던 점도 있었어요, 하지만...</h2><p>거의 완벽에 가까운 칠성사이다 제로지만<br>아쉬운 점이 아주 없지는 않더라고요.<br>사용하면서 느낀 솔직한 단점 두 가지를 말씀드릴게요.</p><p>첫 번째는 <b>탄산 유지력</b>이에요.<br>210ml 캔이라 보통 한 번에 다 마시는 경우가 많지만<br>혹시라도 조금 남겨두면 탄산이 예상보다 빨리 빠지는 느낌이었어요.<br>한두 모금 남긴 상태로 오래 두면 확실히 청량감이 덜하더라고요.</p><p>그래도 대부분의 경우 시원하게 들이켜다 보면<br>한 번에 비우게 되는 양이라<br>크게 신경 쓰이는 부분은 아니었답니다.<br>오히려 한 번에 신선한 탄산을 즐길 수 있다는 장점이 더 컸어요.</p><p>두 번째는 아주 민감하신 분들은<br><b>제로 특유의 감미료 맛</b>을<br>아주 약하게 느끼실 수도 있다는 점이에요.<br>저는 거의 못 느꼈지만,<br>감미료에 민감한 분들은 처음엔 어색할 수도 있겠다 싶었어요.</p><blockquote>"다소 섞여 나온 알룰로스 단맛에 호불호가 갈릴 수 있습니다."</blockquote><p>하지만 이러한 사소한 아쉬움에도 불구하고<br>맛, 건강, 편의성 등 장점이 훨씬 커서<br>저는 정말 만족하며 꾸준히 마시고 있어요.<br>솔직히 이 정도면 단점은 거의 없다고 봐도 무방할 것 같아요.</p>',
      //     },
      //     {
      //       html: "<h2>총평: 왜 칠성사이다 제로를 추천할까요?</h2><p>저는 요즘 식사 때나 기분 전환이 필요할 때마다<br>망설임 없이 칠성사이다 제로를 찾게 되더라고요.<br>진정한 <b>'냉장고 필수템'</b>으로 자리 잡았습니다.</p><p><b>0칼로리, 0당</b>인데도 불구하고<br>오리지널 칠성사이다의 맛과 청량감을<br>그대로 느낄 수 있다는 점이 가장 큰 매력인 것 같아요.<br>맛과 건강, 두 마리 토끼를 다 잡았다고 할까요?</p><p>특히 210ml의 적당한 용량은<br>휴대성도 좋고, 탄산 빠질 걱정 없이<br>항상 신선하게 마실 수 있게 해줘서 정말 편리해요.<br>저처럼 탄산음료를 애정 하는 분들께는<br>정말 희소식 같은 제품이라고 생각합니다.</p><p></p><p>만약 저처럼 탄산음료를 좋아하는데<br>칼로리나 당 때문에 망설이셨던 분들이 있다면,<br>칠성사이다 제로는 후회하지 않을 최선의 선택이 될 거예요.<br>한 번 경험해보시면 분명<br>저처럼 꾸준히 찾게 될 거라고 확신합니다!<br>오늘도 시원한 칠성사이다 제로 덕분에 피자 맛있게 먹었네요 ㅎㅎ</p>",
      //     },
      //   ],
      //   jsonLD: {
      //     '@type': 'Product',
      //     aggregateRating: {
      //       '@type': 'AggregateRating',
      //       ratingValue: 5,
      //       reviewCount: 1,
      //     },
      //     image: '',
      //     brand: '롯데칠성',
      //     description:
      //       '당 걱정 없이 즐기는 깔끔하고 청량한 칠성사이다 제로! 오리지널 맛 그대로 시원함을 만끽할 수 있어 다이어트 중에도 부담 없이 즐기기 좋습니다.',
      //     name: '칠성사이다 제로 210ml',
      //   },
      //   tags: [
      //     '칠성사이다제로',
      //     '롯데칠성',
      //     '제로칼로리사이다',
      //     '무설탕탄산음료',
      //     '다이어트음료',
      //     '혈당관리음료',
      //     '청량음료',
      //     '자취생음료',
      //     '식사음료',
      //     '여름음료',
      //     '칠성사이다제로후기',
      //     '제로사이다추천',
      //     '가성비제로음료',
      //     '작은캔사이다',
      //   ],
      //   title: '이젠 칼로리 걱정 없이 즐겨요! 칠성사이다 제로 솔직 후기',
      // }

      // 썸네일 생성
      await this.jobLogsService.log(jobId, '썸네일 이미지 생성 시작')
      const localThumbnailUrl = await this.generateThumbnail(blogPost.thumbnailText, productData)
      await this.jobLogsService.log(jobId, '썸네일 이미지 생성 완료')

      // 이미지 업로드
      await this.jobLogsService.log(jobId, '이미지 등록 시작')
      // 썸네일과 상품 이미지 병렬 업로드
      const [uploadedThumbnailImages, uploadedImages] = await Promise.all([
        this.uploadImages([localThumbnailUrl], platform, accountId),
        this.uploadImages(productData.images, platform, accountId),
      ])
      const uploadedThumbnailImage = uploadedThumbnailImages[0]
      await this.jobLogsService.log(jobId, '이미지 등록 완료')

      // 조합합수(생성된 이미지, 썸네일, 내용 등을 조합해서 html(string)로 만들기)
      await this.jobLogsService.log(jobId, 'HTML 콘텐츠 조합 시작')
      const contentHtml = this.combineHtmlContent({
        productData,
        platform,
        sections: blogPost.sections.map(s => s.html),
        thumbnailUrl: uploadedThumbnailImage,
        imageUrls: uploadedImages,
        jsonLD: blogPost.jsonLD,
        affiliateUrl: productData.affiliateUrl,
        imageDistributionType: 'even', // 'serial' 또는 'even' 선택
      })
      await this.jobLogsService.log(jobId, 'HTML 콘텐츠 조합 완료')

      // 지정된 블로그로 발행 (AI가 생성한 제목 사용)
      await this.jobLogsService.log(jobId, `${platform} 블로그 발행 시작`)
      const publishResult = await this.publishToBlog({
        accountId,
        platform,
        title: blogPost.title,
        localThumbnailUrl,
        thumbnailUrl: uploadedThumbnailImage,
        contentHtml,
        category: coupangBlogJob.category,
        tags: blogPost.tags,
      })
      const publishedUrl = publishResult.url
      await this.jobLogsService.log(jobId, `${platform} 블로그 발행 완료`)

      // 발행 완료 시 DB 업데이트
      await this.prisma.coupangBlogJob.update({
        where: { jobId },
        data: {
          coupangAffiliateLink: productData.affiliateUrl,
          title: productData.affiliateUrl,
          content: contentHtml,
          tags: blogPost.tags,
          resultUrl: publishedUrl,
          status: CoupangBlogPostJobStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      })

      this.logger.log(`쿠팡 블로그 포스트 작업 완료: ${jobId}`)
      await this.jobLogsService.log(jobId, '쿠팡 블로그 포스트 작업 완료')

      return {
        resultUrl: publishedUrl,
        resultMsg: '쿠팡 리뷰 포스트가 성공적으로 발행되었습니다.',
      }
    } catch (error) {
      this.logger.error(`쿠팡 블로그 포스트 작업 실패: ${jobId}`, error)
      throw error
    } finally {
      // 임시폴더 정리
      const tempDir = path.join(EnvConfig.tempDir)
      if (fs.existsSync(tempDir)) {
        try {
          // fs.rmSync를 사용하여 더 안전하게 폴더 삭제
          fs.rmSync(tempDir, { recursive: true, force: true })
          this.logger.log(`쿠팡 이미지 임시 폴더 정리 완료: ${tempDir}`)
        } catch (error) {
          this.logger.warn(`쿠팡 이미지 임시 폴더 정리 실패: ${tempDir}`, error)
        }
      }
    }
  }

  /**
   * CoupangBlogPostJob 생성
   */
  async createCoupangBlogPostJob(jobData: CreateCoupangBlogPostJobDto): Promise<CoupangBlogPostJobResponse> {
    try {
      // Job 생성
      const job = await this.prisma.job.create({
        data: {
          targetType: JobTargetType.COUPANG_REVIEW_POSTING,
          subject: jobData.subject,
          desc: jobData.desc,
          status: JobStatus.PENDING,
          priority: jobData.priority || 1,
          scheduledAt: jobData.scheduledAt ? new Date(jobData.scheduledAt) : new Date(),
        },
      })

      // CoupangBlogJob 생성
      const coupangBlogJob = await this.prisma.coupangBlogJob.create({
        data: {
          coupangUrl: jobData.coupangUrl,
          coupangAffiliateLink: jobData.coupangAffiliateLink,
          title: jobData.title,
          content: jobData.content,
          labels: jobData.labels,
          tags: jobData.tags,
          category: jobData.category,
          status: CoupangBlogPostJobStatus.DRAFT,
          jobId: job.id,
          bloggerAccountId: jobData.bloggerAccountId,
          wordpressAccountId: jobData.wordpressAccountId,
          tistoryAccountId: jobData.tistoryAccountId,
        },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 조회
   */
  async getCoupangBlogPostJob(jobId: string): Promise<CoupangBlogPostJobResponse | null> {
    try {
      const coupangBlogJob = await this.prisma.coupangBlogJob.findUnique({
        where: { jobId },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      if (!coupangBlogJob) {
        return null
      }

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 목록 조회
   */
  async getCoupangBlogPostJobs(status?: CoupangBlogPostJobStatus): Promise<CoupangBlogPostJobResponse[]> {
    try {
      const where: any = {}
      if (status) {
        where.status = status
      }

      const coupangBlogJobs = await this.prisma.coupangBlogJob.findMany({
        where,
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return coupangBlogJobs.map(coupangBlogJob => this.mapToResponseDto(coupangBlogJob))
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 목록 조회 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 업데이트
   */
  async updateCoupangBlogPostJob(
    jobId: string,
    updateData: UpdateCoupangBlogPostJobDto,
  ): Promise<CoupangBlogPostJobResponse> {
    try {
      // publishedAt 처리 로직
      let publishedAt: Date | null = null
      if (updateData.publishedAt) {
        publishedAt = new Date(updateData.publishedAt)
      } else if (updateData.status === CoupangBlogPostJobStatus.PUBLISHED) {
        publishedAt = new Date()
      }

      const coupangBlogJob = await this.prisma.coupangBlogJob.update({
        where: { jobId },
        data: {
          title: updateData.title,
          content: updateData.content,
          labels: updateData.labels,
          tags: updateData.tags,
          category: updateData.category,
          status: updateData.status,
          resultUrl: updateData.resultUrl,
          coupangAffiliateLink: updateData.coupangAffiliateLink,
          publishedAt,
        },
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 삭제
   */
  async deleteCoupangBlogPostJob(jobId: string): Promise<void> {
    try {
      await this.prisma.coupangBlogJob.delete({
        where: { jobId },
      })
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 삭제 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_DELETE_FAILED)
    }
  }

  /**
   * CoupangBlogPostJob 상태 업데이트
   */
  async updateCoupangBlogPostJobStatus(
    jobId: string,
    status: CoupangBlogPostJobStatus,
  ): Promise<CoupangBlogPostJobResponse> {
    try {
      const updateData: any = { status }

      if (status === CoupangBlogPostJobStatus.PUBLISHED) {
        updateData.publishedAt = new Date()
      }

      const coupangBlogJob = await this.prisma.coupangBlogJob.update({
        where: { jobId },
        data: updateData,
        include: {
          job: true,
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      return this.mapToResponseDto(coupangBlogJob)
    } catch (error) {
      this.logger.error('CoupangBlogPostJob 상태 업데이트 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_UPDATE_FAILED)
    }
  }

  /**
   * 응답 DTO로 매핑
   */
  private mapToResponseDto(coupangBlogJob: CoupangBlogJob): CoupangBlogPostJobResponse {
    return {
      id: coupangBlogJob.id,
      coupangUrl: coupangBlogJob.coupangUrl,
      coupangAffiliateLink: coupangBlogJob.coupangAffiliateLink,
      title: coupangBlogJob.title,
      content: coupangBlogJob.content,
      labels: coupangBlogJob.labels,
      tags: coupangBlogJob.tags,
      category: coupangBlogJob.category,
      resultUrl: coupangBlogJob.resultUrl,
      status: coupangBlogJob.status as CoupangBlogPostJobStatus,
      publishedAt: coupangBlogJob.publishedAt?.toISOString(),
      createdAt: coupangBlogJob.createdAt.toISOString(),
      updatedAt: coupangBlogJob.updatedAt.toISOString(),
      jobId: coupangBlogJob.jobId,
      bloggerAccountId: coupangBlogJob.bloggerAccountId,
      wordpressAccountId: coupangBlogJob.wordpressAccountId,
      tistoryAccountId: coupangBlogJob.tistoryAccountId,
    }
  }

  /**
   * 플랫폼별 계정 사전 준비 (로그인/인증 상태 확인 및 처리)
   */
  private async preparePlatformAccount(
    platform: 'tistory' | 'wordpress' | 'google',
    accountId: number | string,
  ): Promise<void> {
    try {
      this.logger.log(`${platform} 계정 사전 준비 시작: ${accountId}`)

      switch (platform) {
        case 'tistory':
          await this.prepareTistoryAccount(accountId as number)
          break
        default:
          throw new CustomHttpException(ErrorCode.INVALID_INPUT, {
            message: `지원하지 않는 플랫폼: ${platform}`,
          })
      }

      this.logger.log(`${platform} 계정 사전 준비 완료: ${accountId}`)
    } catch (error) {
      this.logger.error(`${platform} 계정 사전 준비 실패: ${accountId}`, error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: `${platform} 계정 준비에 실패했습니다: ${error.message}`,
      })
    }
  }

  /**
   * 티스토리 계정 준비 (로그인 상태 확인 및 처리)
   */
  private async prepareTistoryAccount(accountId: number): Promise<void> {
    // 티스토리 계정 정보 조회
    const tistoryAccount = await this.prisma.tistoryAccount.findUnique({
      where: { id: accountId },
    })

    if (!tistoryAccount) {
      throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
        message: `티스토리 계정을 찾을 수 없습니다: ${accountId}`,
      })
    }

    // 브라우저 세션을 통해 로그인 상태 확인 및 처리

    const { browser } = await this.tistoryAutomationService.initializeBrowserWithLogin(
      tistoryAccount.loginId,
      tistoryAccount.tistoryUrl,
      true,
    )
    await browser.close()
  }
}
