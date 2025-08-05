import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CoupangCrawlerService } from '@main/app/modules/coupang-crawler/coupang-crawler.service'
import { CoupangPartnersService } from '@main/app/modules/coupang-partners/coupang-partners.service'
import { TistoryService } from '@main/app/modules/tistory/tistory.service'
import { WordPressService } from '@main/app/modules/wordpress/wordpress.service'
import { GoogleBloggerService } from '@main/app/modules/google/blogger/google-blogger.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobTargetType } from '@render/api'
import { CoupangBlogJob } from '@prisma/client'
import { CoupangBlogPostJobStatus, CoupangBlogPostJobResponse } from './coupang-blog-post-job.types'
import { CreateCoupangBlogPostJobDto } from './dto/create-coupang-blog-post-job.dto'
import { UpdateCoupangBlogPostJobDto } from './dto/update-coupang-blog-post-job.dto'
import { CoupangProductData as CoupangCrawlerProductData } from '@main/app/modules/coupang-crawler/coupang-crawler.types'
import { CoupangAffiliateLink } from '@main/app/modules/coupang-partners/coupang-partners.types'
import { Type } from '@google/genai'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { JobStatus } from '@main/app/modules/job/job.types'
import { chromium, Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { EnvConfig } from '@main/config/env.config'

interface CoupangProductData {
  title: string
  price: string
  originalUrl: string
  affiliateUrl: string
  images: string[]
  reviews: any[]
}

interface BlogPostData {
  accountId: number | string
  platform: string
  title: string
  localThumbnailUrl: string
  thumbnailUrl: string
  contentHtml: string
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
    private readonly wordpressService: WordPressService,
    private readonly googleBloggerService: GoogleBloggerService,
  ) {}

  /**
   * 1. 쿠팡 크롤링
   */
  private async crawlCoupangProduct(coupangUrl: string): Promise<CoupangProductData> {
    try {
      this.logger.log(`쿠팡 상품 크롤링 시작: ${coupangUrl}`)

      // 쿠팡 상품 정보 크롤링
      const crawledData: CoupangCrawlerProductData = await this.coupangCrawler.crawlProductInfo(coupangUrl)

      this.logger.log(`쿠팡 상품 크롤링 완료: ${crawledData.title}`)

      return {
        title: crawledData.title,
        price: crawledData.price.toString(),
        originalUrl: coupangUrl,
        affiliateUrl: '', // 2단계에서 설정
        images: crawledData.images,
        reviews: crawledData.reviews ? Object.values(crawledData.reviews).flat() : [],
      }
    } catch (error) {
      this.logger.error('쿠팡 크롤링 실패:', error)
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
          throw new Error(`지원하지 않는 플랫폼: ${platform}`)
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
        if (browser) {
          await browser.close()
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
    platform,
    sections,
    affiliateUrl,
    jsonLD,
    thumbnailUrl,
    imageUrls,
    imageDistributionType = 'serial', // 새로운 매개변수 추가
  }: {
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
    const purchaseLinkHtml = affiliateUrl
      ? `
        <div class="purchase-link" style="text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <a href="${affiliateUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            🛒 구매하기
          </a>
        </div>
      `
      : ''

    const combinedSectionHtml = sections
      .map(
        (section, index) => `
      <div class="section" style="margin: 20px 0;">
          ${section}
          
          ${sectionImagesHtml[index] || ''}
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

    // 전체 HTML 조합
    const combinedHtml = `
        <div class="blog-post">
          ${thumbnailHtml}
          
          ${combinedSectionHtml}
          
          ${purchaseLinkHtml}
          
          ${coupangAnnounce}
          
          ${jsonLdScript}
        </div>
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
“~같아요”, “~느껴지더라고요”, “저만 그런 건 아니죠?”, “ㅠㅠ” 등의 자연스러운 어투
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
리뷰: ${JSON.stringify(coupangProductData.reviews)}`

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
            keywords: [blogPostData.title],
            postVisibility: 'public',
          })
          publishedUrl = tistoryResult.url
          break
        case 'wordpress':
          const wordpressResult = await this.wordpressService.publishPost(blogPostData.accountId as number, {
            title: blogPostData.title,
            content: blogPostData.contentHtml,
            featuredImage: blogPostData.thumbnailUrl,
          })
          publishedUrl = wordpressResult.url
          break
        case 'google':
          // Google Blogger는 bloggerBlogId와 oauthId가 필요하므로 accountId를 bloggerAccountId로 사용
          const bloggerAccount = await this.prisma.bloggerAccount.findUnique({
            where: { id: blogPostData.accountId as number },
            include: { oauth: true },
          })

          if (!bloggerAccount) {
            throw new Error(`Blogger 계정을 찾을 수 없습니다: ${blogPostData.accountId}`)
          }

          const googleResult = await this.googleBloggerService.publish({
            title: blogPostData.title,
            content: blogPostData.contentHtml,
            bloggerBlogId: bloggerAccount.bloggerBlogId,
            oauthId: bloggerAccount.googleOauthId,
          })
          publishedUrl = googleResult.url
          break
        default:
          throw new Error(`지원하지 않는 플랫폼: ${blogPostData.platform}`)
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

      // 작업 정보 조회
      const coupangBlogJob = await this.prisma.coupangBlogJob.findUnique({
        where: { jobId },
        include: {
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      if (!coupangBlogJob) {
        throw new Error('CoupangBlogJob not found')
      }

      // 쿠팡 크롤링
      const productData = await this.crawlCoupangProduct(coupangBlogJob.coupangUrl)

      // 쿠팡 어필리에이트 생성
      const affiliateUrl = await this.createAffiliateLink(coupangBlogJob.coupangUrl)
      productData.affiliateUrl = affiliateUrl

      // 계정 설정 확인 및 플랫폼 결정
      const { platform, accountId } = this.validateBlogAccount(coupangBlogJob)

      // 블로그 포스트 생성
      const blogPost = await this.generateBlogPostSections(productData)

      // 썸네일 생성
      const localThumbnailUrl = await this.generateThumbnail(blogPost.thumbnailText, productData)
      const uploadedThumbnailImage = (await this.uploadImages([localThumbnailUrl], platform, accountId))[0]

      // 이미지 업로드
      const uploadedImages = await this.uploadImages(productData.images, platform, accountId)

      // 조합합수(생성된 이미지, 썸네일, 내용 등을 조합해서 html(string)로 만들기)
      const contentHtml = this.combineHtmlContent({
        platform,
        sections: blogPost.sections.map(s => s.html),
        thumbnailUrl: uploadedThumbnailImage,
        imageUrls: uploadedImages,
        jsonLD: blogPost.jsonLD,
        affiliateUrl: productData.affiliateUrl,
        imageDistributionType: 'even', // 'serial' 또는 'even' 선택
      })

      // 지정된 블로그로 발행 (AI가 생성한 제목 사용)
      const publishResult = await this.publishToBlog({
        accountId,
        platform,
        title: blogPost.title,
        localThumbnailUrl,
        thumbnailUrl: uploadedThumbnailImage,
        contentHtml,
        tags: blogPost.tags,
      })
      const publishedUrl = publishResult.url

      this.logger.log(`쿠팡 블로그 포스트 작업 완료: ${jobId}`)

      return {
        resultUrl: publishedUrl,
        resultMsg: '쿠팡 리뷰 포스트가 성공적으로 발행되었습니다.',
      }
    } catch (error) {
      this.logger.error(`쿠팡 블로그 포스트 작업 실패: ${jobId}`, error)
      throw error
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
          publishedAt: updateData.status === CoupangBlogPostJobStatus.PUBLISHED ? new Date() : null,
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
}
