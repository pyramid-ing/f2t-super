import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AgodaCrawlerErrorClass, AgodaCrawlerService } from '@main/app/modules/agoda-crawler/agoda-crawler.service'
import { AgodaPartnersService } from '@main/app/modules/agoda-partners/agoda-partners.service'
import { TistoryService } from '@main/app/modules/tistory/tistory.service'
import { TistoryAutomationService } from '@main/app/modules/tistory/tistory-automation.service'
import { WordPressService } from '@main/app/modules/wordpress/wordpress.service'
import { GoogleBloggerService } from '@main/app/modules/google/blogger/google-blogger.service'
import { JobLogsService } from '@main/app/modules/job/job-logs/job-logs.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { AgodaBlogJob } from '@prisma/client'
import { AgodaBlogPostJobStatus, AgodaBlogPost, AgodaBlogPostPublish } from './agoda-blog-post-job.types'
import { AgodaAffiliateLink } from '@main/app/modules/agoda-partners/agoda-partners.types'
import { Type } from '@google/genai'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { BlogType } from '@main/app/modules/job/job.types'
import { Browser, chromium, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { EnvConfig } from '@main/config/env.config'
import { AgodaProductData } from '@main/app/modules/agoda-crawler/agoda-crawler.types'
import { StorageService } from '@main/app/modules/google/storage/storage.service'
import { UtilService } from '@main/app/modules/util/util.service'
import axios from 'axios'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { SettingsService } from '@main/app/modules/settings/settings.service'

// ---- 확장 스키마 타입 (파일 스코프) ----
type FaqItem = { question: string; answer: string }
type ProsCons = { pros: string[]; cons: string[] }
type RatingSummary = { score: number; reviewCount?: number; highlights?: string[] }
type Facts = { checkIn?: string; checkOut?: string; location?: string; features?: string[] }
type CTA = { label: string; hrefText: string; position?: 'top' | 'middle' | 'bottom' }
type Table = { title?: string; rows: { label: string; value: string }[] }
type AgodaBlogPostExtended = AgodaBlogPost & {
  faq?: FaqItem[]
  prosCons?: ProsCons
  ratingSummary?: RatingSummary
  facts?: Facts
  ctas?: CTA[]
  gallery?: string[]
  tables?: Table[]
}

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

@Injectable()
export class AgodaBlogPostJobService {
  private readonly logger = new Logger(AgodaBlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly agodaCrawler: AgodaCrawlerService,
    private readonly agodaPartners: AgodaPartnersService,
    private readonly geminiService: GeminiService,
    private readonly tistoryService: TistoryService,
    private readonly tistoryAutomationService: TistoryAutomationService,
    private readonly wordpressService: WordPressService,
    private readonly googleBloggerService: GoogleBloggerService,
    private readonly jobLogsService: JobLogsService,
    private readonly storageService: StorageService,
    private readonly settingsService: SettingsService,
    private readonly utilService: UtilService,
  ) {}

  /**
   * 아고다 블로그 포스트 작업 처리 (메인 프로세스)
   */
  public async processJob(jobId: string): Promise<{ resultUrl?: string; resultMsg: string }> {
    try {
      this.logger.log(`아고다 블로그 포스트 작업 시작: ${jobId}`)
      await this.jobLogsService.log(jobId, '아고다 블로그 포스트 작업 시작')

      await this.checkPermission(Permission.USE_AGODA_POSTING)

      // 작업 정보 조회
      const agodaBlogJob = await this.prisma.agodaBlogJob.findUnique({
        where: { jobId },
        include: {
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      assert(agodaBlogJob, 'AgodaBlogJob not found')

      // 계정 설정 확인 및 플랫폼 결정
      const { platform, accountId } = this.validateBlogAccount(agodaBlogJob)

      // 플랫폼별 계정 사전 준비 (로그인/인증 상태 확인 및 처리)
      await this.jobLogsService.log(jobId, `${platform} 계정 사전 준비 시작`)
      await this.preparePlatformAccount(platform, accountId)
      await this.jobLogsService.log(jobId, `${platform} 계정 사전 준비 완료`)

      // 대상 URL들 준비 (단일/비교 공용)
      const urls: string[] = Array.isArray(agodaBlogJob.agodaUrls) ? (agodaBlogJob.agodaUrls as string[]) : []
      const isComparison = urls.length > 1

      // 아고다 크롤링 + 어필리에이트 (다건)
      await this.jobLogsService.log(jobId, `아고다 상품 정보 수집 시작 (${urls.length}개)`)
      const products = await this.crawlMultipleProducts(urls)
      await this.jobLogsService.log(jobId, '아고다 상품 정보 수집 완료')

      // 블로그 포스트 생성
      await this.jobLogsService.log(jobId, 'AI 블로그 내용 생성 시작')
      const blogPost = isComparison
        ? await (async () => {
            const hotelSummaries = await Promise.all(
              products.map(async p => {
                const summary = await this.generateHotelSummaryPost(p)
                return this.fillMissingFactsFromProduct(summary, p)
              }),
            )
            const overview = await this.generateComparisonOverview(hotelSummaries)
            return overview
          })()
        : await this.generateBlogPostSections(products[0])
      await this.jobLogsService.log(jobId, 'AI 블로그 내용 생성 완료')

      // 썸네일 생성
      await this.jobLogsService.log(jobId, '썸네일 이미지 생성 시작')
      const localThumbnailUrl = await this.generateThumbnail(blogPost.thumbnailText, products[0]?.images[0])
      await this.jobLogsService.log(jobId, '썸네일 이미지 생성 완료')

      // 이미지 업로드
      await this.jobLogsService.log(jobId, '이미지 등록 시작')
      // 썸네일과 상품 이미지 병렬 업로드
      const uploaded = await this.uploadAllImages(products, localThumbnailUrl, platform, accountId)
      await this.jobLogsService.log(jobId, '이미지 등록 완료')

      // 조합합수(생성된 이미지, 썸네일, 내용 등을 조합해서 html(string)로 만들기)
      await this.jobLogsService.log(jobId, 'HTML 콘텐츠 조합 시작')
      const contentHtml = isComparison
        ? this.combineComparisonHtmlContent({
            products,
            platform,
            sections: blogPost.sections.map(s => s.html),
            thumbnailUrl: uploaded.thumbnail,
            imageUrls: uploaded.productImages,
            jsonLD: blogPost.jsonLD,
            imageDistributionType: 'even',
            extras: blogPost as AgodaBlogPostExtended,
          })
        : this.combineHtmlContent({
            productData: products[0],
            platform,
            sections: blogPost.sections.map(s => s.html),
            thumbnailUrl: uploaded.thumbnail,
            imageUrls: uploaded.productImages,
            jsonLD: blogPost.jsonLD,
            affiliateUrl: products[0].affiliateUrl,
            imageDistributionType: 'even',
            extras: blogPost as AgodaBlogPostExtended,
          })
      await this.jobLogsService.log(jobId, 'HTML 콘텐츠 조합 완료')

      // 지정된 블로그로 발행 (AI가 생성한 제목 사용)
      await this.jobLogsService.log(jobId, `${platform} 블로그 발행 시작`)
      const publishResult = await this.publishToBlog({
        accountId,
        platform,
        title: blogPost.title,
        localThumbnailUrl,
        thumbnailUrl: uploaded.thumbnail,
        contentHtml,
        category: agodaBlogJob.category,
        tags: blogPost.tags,
      })
      const publishedUrl = publishResult.url
      await this.jobLogsService.log(jobId, `${platform} 블로그 발행 완료`)

      // 발행 완료 시 DB 업데이트
      await this.prisma.agodaBlogJob.update({
        where: { jobId },
        data: {
          title: blogPost.title,
          content: contentHtml,
          tags: blogPost.tags,
          resultUrl: publishedUrl,
          status: AgodaBlogPostJobStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      })

      this.logger.log(`아고다 블로그 포스트 작업 완료: ${jobId}`)
      await this.jobLogsService.log(jobId, '아고다 블로그 포스트 작업 완료')

      return {
        resultUrl: publishedUrl,
        resultMsg: '아고다 리뷰 포스트가 성공적으로 발행되었습니다.',
      }
    } catch (error) {
      this.logger.error(`아고다 블로그 포스트 작업 실패: ${jobId}`, error)
      throw error
    } finally {
      // 임시폴더 정리
      const tempDir = path.join(EnvConfig.tempDir)
      if (fs.existsSync(tempDir)) {
        try {
          // fs.rmSync를 사용하여 더 안전하게 폴더 삭제
          fs.rmSync(tempDir, { recursive: true, force: true })
          this.logger.log(`아고다 이미지 임시 폴더 정리 완료: ${tempDir}`)
        } catch (error) {
          this.logger.warn(`아고다 이미지 임시 폴더 정리 실패: ${tempDir}`, error)
        }
      }
    }
  }

  /**
   * 1. 아고다 크롤링
   */
  private async crawlAgodaProduct(agodaUrl: string): Promise<AgodaProductData> {
    try {
      // 아고다 상품 정보 크롤링
      const crawledData: AgodaProductData = await this.agodaCrawler.crawlProductInfo(agodaUrl)

      this.logger.log(`아고다 상품 크롤링 완료: ${crawledData.title}`)

      return {
        title: crawledData.title,
        originalUrl: agodaUrl,
        affiliateUrl: '', // 2단계에서 설정
        originImageUrls: crawledData.originImageUrls,
        images: crawledData.images,
        reviews: crawledData.reviews,
        checkIn: crawledData.checkIn,
        checkOut: crawledData.checkOut,
        location: crawledData.location,
        features: crawledData.features,
        address: crawledData.address,
        airportTransit: crawledData.airportTransit,
        publicTransit: crawledData.publicTransit,
        nearbyAmenities: crawledData.nearbyAmenities,
        proximityHighlights: crawledData.proximityHighlights,
        description: crawledData.description,
        media: crawledData.media,
        topPlaces: crawledData.topPlaces,
        nearbyPlaces: crawledData.nearbyPlaces,
      }
    } catch (error) {
      this.logger.error('아고다 크롤링 실패:', error)
      if (error instanceof AgodaCrawlerErrorClass) {
        throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
          message: `아고다 상품 정보 크롤링에 실패했습니다: ${error.message}`,
        })
      }

      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: '아고다 상품 정보 크롤링에 실패했습니다.',
      })
    }
  }

  /**
   * 2. 아고다 어필리에이트 생성
   */
  private async createAffiliateLink(agodaUrl: string): Promise<string> {
    try {
      this.logger.log(`아고다 어필리에이트 링크 생성 시작: ${agodaUrl}`)

      // 아고다 어필리에이트 링크 생성
      const affiliateData: AgodaAffiliateLink = await this.agodaPartners.createAffiliateLink(agodaUrl)

      this.logger.log(`아고다 어필리에이트 링크 생성 완료: ${affiliateData.shortenUrl}`)

      return affiliateData.shortenUrl
    } catch (error) {
      this.logger.error('아고다 어필리에이트 링크 생성 실패:', error)
      if (error instanceof CustomHttpException) throw error
      throw new CustomHttpException(ErrorCode.COUPANG_PARTNERS_LINK_FAILED)
    }
  }

  /**
   * 계정 설정 확인 및 플랫폼 결정
   */
  private validateBlogAccount(agodaBlogJob: AgodaBlogJob): { platform: BlogType; accountId: number | string } {
    if (agodaBlogJob.tistoryAccountId) {
      return {
        platform: BlogType.TISTORY,
        accountId: agodaBlogJob.tistoryAccountId,
      }
    } else if (agodaBlogJob.wordpressAccountId) {
      return {
        platform: BlogType.WORDPRESS,
        accountId: agodaBlogJob.wordpressAccountId,
      }
    } else if (agodaBlogJob.bloggerAccountId) {
      return {
        platform: BlogType.GOOGLE_BLOG,
        accountId: agodaBlogJob.bloggerAccountId,
      }
    } else {
      throw new CustomHttpException(ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED, {
        message: '블로그 계정이 설정되지 않았습니다. 티스토리, 워드프레스 또는 블로그스팟 계정을 먼저 설정해주세요.',
      })
    }
  }

  /**
   * 3. 이미지 업로드 (티스토리, 워드프레스, 구글 블로그)
   */
  private async uploadImages(imagePaths: string[], platform: BlogType, accountId: number | string): Promise<string[]> {
    try {
      this.logger.log(`${platform} 이미지 업로드 시작: ${imagePaths.length}개`)

      assert(imagePaths.length > 0, '업로드할 이미지가 없습니다')

      let uploadedImages: string[] = []

      switch (platform) {
        case BlogType.TISTORY:
          uploadedImages = await this.tistoryService.uploadImages(accountId as number, imagePaths)
          break
        case BlogType.WORDPRESS:
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
        case BlogType.GOOGLE_BLOG:
          // Google Blogger: GCS에 업로드 후 URL 사용
          uploadedImages = []
          for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i]
            try {
              const uploadedUrl = await this.uploadImageToGCS(imagePath, i)
              uploadedImages.push(uploadedUrl)
              this.logger.log(`GCS 이미지 업로드 완료: ${imagePath} → ${uploadedUrl}`)
            } catch (error) {
              this.logger.error(`GCS 이미지 업로드 실패 (${imagePath}):`, error)
              throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, {
                message: `${platform} 이미지 업로드에 실패했습니다. 이미지 URL: ${imagePath}`,
              })
            }
          }
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
   * GCS 업로드 헬퍼: 로컬/원격 이미지를 버퍼로 읽어 WebP 최적화 후 업로드
   */
  private async uploadImageToGCS(imageUrlOrPath: string, sectionIndex: number): Promise<string> {
    let imageBuffer: Buffer
    if (this.utilService.isLocalPath(imageUrlOrPath)) {
      const normalizedPath = path.normalize(imageUrlOrPath)
      imageBuffer = fs.readFileSync(normalizedPath)
    } else {
      const response = await axios.get(imageUrlOrPath, {
        responseType: 'arraybuffer',
        timeout: 30000,
      })
      imageBuffer = Buffer.from(response.data)
    }

    // 파일명/확장자/콘텐츠 타입 결정
    let originalName = ''
    let ext = ''
    if (this.utilService.isLocalPath(imageUrlOrPath)) {
      originalName = path.basename(path.normalize(imageUrlOrPath))
      ext = path.extname(originalName).toLowerCase()
    } else {
      try {
        const u = new URL(imageUrlOrPath)
        originalName = path.basename(u.pathname)
        ext = path.extname(originalName).toLowerCase()
      } catch {
        originalName = ''
        ext = ''
      }
    }

    const contentType = (() => {
      switch (ext) {
        case '.webp':
          return 'image/webp'
        case '.png':
          return 'image/png'
        case '.jpg':
        case '.jpeg':
          return 'image/jpeg'
        default:
          return 'image/webp'
      }
    })()

    const finalExt = ext || '.webp'
    const fileName =
      originalName && originalName.includes('.') ? originalName : `blog-image-${sectionIndex}-${Date.now()}${finalExt}`

    const uploadResult = await this.storageService.uploadImage(imageBuffer, {
      contentType,
      fileName,
    })
    return typeof uploadResult === 'string' ? uploadResult : uploadResult.url
  }

  /**
   * 썸네일 생성 (메인 이미지 + 위에 글자 생성)
   */
  private async generateThumbnail(thumbnailText: { lines: string[] }, image?: string): Promise<string> {
    try {
      this.logger.log('썸네일 생성 시작')

      let browser: Browser | null = null
      let page: Page | null = null

      try {
        // 브라우저 시작
        browser = await chromium.launch({
          executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
          headless: EnvConfig.getPlaywrightHeadless(),
        })

        page = await browser.newPage()
        await page.setViewportSize({ width: 1000, height: 1000 })

        // HTML 페이지 생성
        const html = this.generateThumbnailHTML(thumbnailText, image)
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
  private generateThumbnailHTML(thumbnailText: { lines: string[] }, imagePath?: string): string {
    const lines = thumbnailText.lines.map(line => line.trim()).filter(line => line.length > 0)

    // 배경 이미지 설정
    let backgroundStyle = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);'
    // 이미지를 base64로 인코딩
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
    <div class="backdrop"></div>
    <div class="thumbnail-container">
        ${lines.map(line => `<div class="text-line">${line}</div>`).join('')}
    </div>
</body>
</html>
    `
  }

  /**
   * 비교형 HTML 조합 함수 (n개 상품)
   */
  private combineComparisonHtmlContent({
    products,
    platform,
    sections,
    jsonLD,
    thumbnailUrl,
    imageUrls,
    imageDistributionType = 'even',
    extras,
  }: {
    products: AgodaProductData[]
    sections: string[]
    imageUrls: string[]
    thumbnailUrl: string
    jsonLD: any
    platform: BlogType
    imageDistributionType?: 'serial' | 'even'
    extras?: AgodaBlogPostExtended
  }): string {
    this.logger.log('비교형 HTML 조합 시작')

    const thumbnailHtml = this.renderHero(thumbnailUrl, platform)

    // 제품별 업로드 이미지를 균등 분배에서 복원 (flat → per product)
    const perProductImages = this.groupImagesByProduct(products, imageUrls)

    // 1) 호텔별 소개/편의/이미지/리뷰 블록
    const hotelBlocks = products
      .map((p, idx) => this.renderHotelBlock(p, perProductImages[idx] || [], platform))
      .join('')

    // 2) AI 생성 섹션 + 섹션 이미지 배치
    let sectionImagesHtml: string[]
    switch (imageDistributionType) {
      case 'serial':
        sectionImagesHtml = this.generateSerialImageDistribution(sections, imageUrls, platform)
        break
      case 'even':
      default:
        sectionImagesHtml = this.generateEvenImageDistribution(sections, imageUrls, platform)
        break
    }
    // 비교형도 본문 내 [image:*] 치환 적용 (여러 호텔을 합쳐 매칭 풀 구성)
    const mergedForPlaceholder = this.buildMergedForPlaceholders(products)
    const usedOnce = new Set<string>()
    const resolvedSections = sections.map(s => this.replacePlaceholders(s, mergedForPlaceholder, platform, usedOnce))
    const aiSections = resolvedSections
      .map(
        (section, index) => `
      <div class="section" style="margin: 20px 0;">
        ${this.renderSection(section)}
        ${sectionImagesHtml[index] || ''}
      </div>`,
      )
      .join('')

    const style = `${this.getBannerStyle()}${this.getContentStyle()}`

    const agodaAnnounce =
      '이 글에는 제휴 마케팅 링크가 포함되어 있으며, 이를 통해 구매 시 작성자가 소정의 수수료를 받을 수 있습니다.'

    const jsonLdScript = this.renderJsonLd({
      base: { ...jsonLD, image: thumbnailUrl },
      title: products?.[0]?.title ?? '',
      thumbnailUrl,
      faq: extras?.faq ?? [],
    })

    const topCTA = this.renderCTA(
      extras?.ctas?.find(c => c.position === 'top')?.label || '실시간 가격 확인하기',
      products?.[0]?.affiliateUrl,
    )
    const bottomCTA = this.renderCTA(
      extras?.ctas?.find(c => c.position === 'bottom')?.label || '지금 예약하기',
      products?.[0]?.affiliateUrl,
    )

    const galleryHtml = this.renderGallery(imageUrls, platform)
    const prosConsHtml = extras?.prosCons ? this.renderProsCons(extras.prosCons) : ''
    const factsHtml = extras?.facts ? this.renderFactsTable(extras.facts) : ''
    const ratingHtml = extras?.ratingSummary ? this.renderHighlightCard(extras.ratingSummary) : ''

    const html = `
      ${style}
      ${thumbnailHtml}
      ${this.renderNotice('affiliate', agodaAnnounce)}
      ${hotelBlocks}
      ${ratingHtml}
      ${factsHtml}
      ${topCTA}
      ${aiSections}
      ${prosConsHtml}
      ${galleryHtml}
      ${this.renderHotelComparisonTable(products)}
      ${bottomCTA}
      ${jsonLdScript}
    `

    this.logger.log('비교형 HTML 조합 완료')
    return html
  }

  private async generateBlogPostSectionsForComparison(
    products: AgodaProductData[],
  ): Promise<AgodaBlogPost & { title: string }> {
    this.logger.log('Gemini로 비교형 콘텐츠 생성 시작')

    const minimalProducts = products.map(p => ({
      title: p.title,
      review: p.reviews?.positive?.[0] || null,
    }))

    const prompt = `
너는 아고다 어필리에이트 리뷰 전문 작가야. 아래 입력으로 주어진 호텔 목록을 기반으로, 실제 투숙자가 느낀 장단점을 반영한 비교 리뷰를 작성해줘. 예약 링크는 코드에서 자동으로 삽입하니 본문에 직접 언급하거나 URL을 넣지 마.

문체/톤
- 모바일 최적 문단: 한 문단 2~3문장, 한 문장 최대 2줄 느낌
- 대화체·공감형 어투, 과장/이모지/과도한 감탄은 최소화
- 객관 근거: 제공된 리뷰 요약/관찰 포인트를 근거로 서술

콘텐츠 구성(섹션 순서 권장)
1) 도입: 어떤 여행자에게 맞는 호텔을 비교하는지 한 문단 요약
2) 핵심 한줄평: 각 호텔당 1줄 요약(위치/청결/가성비 등 키워드 포함)
3) 위치·접근성: 대중교통/주변 상권 언급(있다면)
4) 객실·청결/편의: 실제 체감 포인트(소음, 침구, 샤워부스 등)
5) 직원·서비스: 친절도, 응대 일화가 있으면 간단히
6) 가격·예약 팁: 성수기/주말, 조식 유무 등 선택 팁(가격 숫자 표기는 피함)
7) 총평: 추천 대상/주의 포인트를 함께 제시(장점≥3, 단점≥1)

작성 규칙
- 링크/가격/재고 표현은 금지. “예약 링크는 본문 하단 배너 참고” 정도의 간접 표현만 가능
- 섹션은 HTML로 반환. 제목은 별도로 생성
- 각 섹션 길이 100~300자, 전체 1600~2200자 권장
- 반드시 FAQ(3개 이상), 장점/개선점, 요약 카드(평점/하이라이트), 팩트 테이블(체크인/체크아웃/위치/특징), CTA 라벨(상/중/하), 갤러리(최소 3장) 포함
 - 본문에 상황에 맞는 이미지 자리표시자 5~8개 삽입: [image:외관|객실|수영장|피트니스|레스토랑|로비|조식|전망|욕실] 또는 [image:관광지:{이름}]
 - 같은 태그 과다 반복 금지, 문맥과 모순되는 태그 금지

출력 스키마
- thumbnailText: 썸네일 큰 글자 1~3줄(최대 6자/줄, “~호텔 비교” 등)
- title: 클릭을 유도하는 제목(호텔명·지역·장점 키워드 포함)
- sections: HTML 조각 배열
- jsonLD: schema.org Product 스키마(간단 요약 기반)
- tags: 검색 유입을 위한 키워드 배열
- faq(자주 묻는 질문, 3개 이상)
- prosCons(장점/개선점)
- ratingSummary(평점/리뷰수/하이라이트)
- facts(체크인/체크아웃/위치/특징)
- ctas(상/중/하 배치용 CTA 라벨)
- tables(필요 시 테이블)

[입력 호텔 간략 정보]
${JSON.stringify(minimalProducts)}
`

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
              description:
                '썸네일이미지용 텍스트, 비교관련 텍스프필요, 줄당 최대 글자수는 6자, 최대 3줄, 예시: 가성비이어폰 3종 비교!',
              required: ['lines'],
            },
            title: {
              type: Type.STRING,
              description: '해당글의 제목, ~3개 비교 등',
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
[냄새제거세제, 실내건조세제, 자취생추천세제, 가성비세제, 찬물세탁용]`,
            },
            faq: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } },
                required: ['question', 'answer'],
              },
              minItems: 3,
            },
            prosCons: {
              type: Type.OBJECT,
              properties: {
                pros: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 3 },
                cons: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 1 },
              },
              required: ['pros', 'cons'],
            },
            ratingSummary: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                reviewCount: { type: Type.NUMBER },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['score'],
            },
            facts: {
              type: Type.OBJECT,
              properties: {
                checkIn: { type: Type.STRING },
                checkOut: { type: Type.STRING },
                location: { type: Type.STRING },
                features: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            ctas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  hrefText: { type: Type.STRING },
                  position: { type: Type.STRING },
                },
                required: ['label', 'hrefText'],
              },
            },

            tables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  rows: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { label: { type: Type.STRING }, value: { type: Type.STRING } },
                      required: ['label', 'value'],
                    },
                  },
                },
                required: ['rows'],
              },
            },
          },
          required: ['thumbnailText', 'sections', 'faq', 'prosCons'],
          propertyOrdering: ['thumbnailText', 'sections'],
        },
      },
    })

    const result = JSON.parse(resp.text) as AgodaBlogPost
    return result
  }

  private async generateHotelSummaryPost(product: AgodaProductData): Promise<AgodaBlogPostExtended> {
    // 단일 호텔 요약은 기존 단일 생성 로직을 재사용
    const base = await this.generateBlogPostSections(product)
    return base as AgodaBlogPostExtended
  }

  private fillMissingFactsFromProduct(post: AgodaBlogPostExtended, product: AgodaProductData): AgodaBlogPostExtended {
    const facts: Facts = {
      checkIn: post.facts?.checkIn || product.checkIn,
      checkOut: post.facts?.checkOut || product.checkOut,
      location: post.facts?.location || product.location,
      features: post.facts?.features || product.features,
    }
    const tables: Table[] = [...(post.tables || [])]
    const travelRows: { label: string; value: string }[] = []
    if (product.address) travelRows.push({ label: '주소', value: product.address })
    if (product.airportTransit) travelRows.push({ label: '공항에서', value: product.airportTransit })
    if (product.publicTransit) travelRows.push({ label: '대중교통', value: product.publicTransit })
    if (product.nearbyAmenities && product.nearbyAmenities.length)
      travelRows.push({ label: '주변 편의시설', value: product.nearbyAmenities.join(', ') })
    if (travelRows.length) tables.push({ title: '이동/편의 정보', rows: travelRows })

    return { ...post, facts, tables }
  }

  private async generateComparisonOverview(
    hotelSummaries: AgodaBlogPostExtended[],
  ): Promise<AgodaBlogPostExtended & { title: string }> {
    this.logger.log('Gemini로 비교 개요 생성 시작')
    const minimal = hotelSummaries.map(h => ({
      title: h.title,
      rating: h.ratingSummary?.score,
      highlights: h.ratingSummary?.highlights || [],
      facts: h.facts || {},
      tags: h.tags || [],
    }))

    const prompt = `
아래 여러 호텔의 요약 정보를 바탕으로 비교형 리뷰의 개요를 생성해줘.

작성 지침
- 과장 없이 실사용자 톤, 모바일 최적 문단(2~3문장)
- 링크/가격 직접 언급 금지, CTA 문구만 포함
- H2/H3 구조를 지키고, 표/하이라이트/FAQ를 포함

필수 출력
- thumbnailText, title, sections(HTML), jsonLD(Product 또는 Article 간단), tags
- faq(3개 이상), prosCons(장점/개선점), ratingSummary(요약), facts(공통 핵심), ctas(상/중/하 라벨), tables(비교/이동/팁 등 필요 표)

[입력 호텔 요약]
${JSON.stringify(minimal)}
`

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
              properties: { lines: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 1, maxItems: 3 } },
              required: ['lines'],
            },
            title: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, properties: { html: { type: Type.STRING } }, required: ['html'] },
              minItems: 1,
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
                },
              },
            },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            faq: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } },
                required: ['question', 'answer'],
              },
              minItems: 3,
            },
            prosCons: {
              type: Type.OBJECT,
              properties: {
                pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                cons: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            ratingSummary: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                reviewCount: { type: Type.NUMBER },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            facts: {
              type: Type.OBJECT,
              properties: {
                checkIn: { type: Type.STRING },
                checkOut: { type: Type.STRING },
                location: { type: Type.STRING },
                features: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            ctas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  hrefText: { type: Type.STRING },
                  position: { type: Type.STRING },
                },
                required: ['label'],
              },
            },
            tables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  rows: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { label: { type: Type.STRING }, value: { type: Type.STRING } },
                      required: ['label', 'value'],
                    },
                  },
                },
                required: ['rows'],
              },
            },
          },
          required: ['thumbnailText', 'sections', 'faq', 'prosCons'],
        },
      },
    })

    const overview = JSON.parse(resp.text) as AgodaBlogPostExtended
    return overview as AgodaBlogPostExtended & { title: string }
  }

  private async uploadAllImages(
    products: AgodaProductData[],
    localThumbnailUrl: string,
    platform: BlogType,
    accountId: number | string,
  ): Promise<{ thumbnail: string; productImages: string[] }> {
    const [thumbnailUploads, productUploads] = await Promise.all([
      this.uploadImages([localThumbnailUrl], platform, accountId),
      this.uploadImages(
        products.flatMap(p => p.images || []),
        platform,
        accountId,
      ),
    ])
    return { thumbnail: thumbnailUploads[0], productImages: productUploads }
  }

  private async crawlMultipleProducts(urls: string[]): Promise<AgodaProductData[]> {
    const products = await Promise.all(
      urls.map(async url => {
        const affiliateUrl = await this.createAffiliateLink(url)
        const data = await this.crawlAgodaProduct(url)
        data.affiliateUrl = affiliateUrl
        return data
      }),
    )
    return products
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
    extras,
  }: {
    productData: AgodaProductData
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
    platform: BlogType
    imageDistributionType?: 'serial' | 'even' // 직렬형 또는 균등형
    extras?: AgodaBlogPostExtended
  }): string {
    this.logger.log('HTML 조합 시작')

    // 썸네일 이미지 HTML
    const thumbnailHtml = this.renderHero(thumbnailUrl, platform)

    // 호텔 단일 상세 블록(소개/편의/이미지/리뷰)
    const hotelBlock = this.renderHotelBlock(productData, imageUrls, platform)

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
               <a class="banner-frame" href="${affiliateUrl}" rel="sponsored noopener noreferrer" target="_blank">
               <img src="${productData.originImageUrls[0]}" alt="${productData.title}" loading="lazy" decoding="async">
                <div class="banner-content">
                  <p class="banner-title">${productData.title}</p>
                </div>
              </a>
              <a class="btn" href="${affiliateUrl}" rel="sponsored noopener noreferrer" target="_blank">최저가 보기</a>
            </div>`

    // 신규: 본문 내 [image:*] 자리표시자 치환
    const usedOnce = new Set<string>()
    const resolvedSections = sections.map(s => this.replacePlaceholders(s, productData, platform, usedOnce))

    const combinedSectionHtml = resolvedSections
      .map(
        (section, index) => `
      <div class="section" style="margin: 20px 0;">
          ${this.renderSection(section)}
          ${sectionImagesHtml[index] || ''}
          ${affiliateHtml}
      </div>
    `,
      )
      .join('')

    const agodaAnnounce =
      '이 글에는 제휴 마케팅 링크가 포함되어 있으며, 이를 통해 구매 시 작성자가 소정의 수수료를 받을 수 있습니다.'

    // JSON-LD 객체를 HTML 스크립트 태그로 변환
    const jsonLdScript = this.renderJsonLd({
      base: { ...jsonLD, image: thumbnailUrl },
      title: productData.title,
      thumbnailUrl,
      faq: extras?.faq ?? [],
    })

    const style = `${this.getBannerStyle()}${this.getContentStyle()}`

    // 전체 HTML 조합
    const topCTA = this.renderCTA(
      extras?.ctas?.find(c => c.position === 'top')?.label || '실시간 가격 확인하기',
      affiliateUrl,
    )
    const midCTA = this.renderCTA(
      extras?.ctas?.find(c => c.position === 'middle')?.label || '가격 확인하기',
      affiliateUrl,
    )
    const bottomCTA = this.renderCTA(
      extras?.ctas?.find(c => c.position === 'bottom')?.label || '지금 예약하기',
      affiliateUrl,
    )

    const prosConsHtml = extras?.prosCons ? this.renderProsCons(extras.prosCons) : ''
    const factsHtml = extras?.facts ? this.renderFactsTable(extras.facts) : ''
    const ratingHtml = extras?.ratingSummary ? this.renderHighlightCard(extras.ratingSummary) : ''
    const galleryHtml = this.renderGallery(imageUrls, platform)

    const combinedHtml = `
          ${style}
          ${thumbnailHtml}
          ${this.renderNotice('affiliate', agodaAnnounce)}
          ${hotelBlock}
          ${ratingHtml}
          ${factsHtml}
          ${topCTA}
          ${combinedSectionHtml}
          ${prosConsHtml}
          ${midCTA}
          ${galleryHtml}
          ${bottomCTA}
          ${jsonLdScript}
      `

    this.logger.log('HTML 조합 완료')
    return combinedHtml
  }

  // 신규: [image:*] 자리표시자 치환기
  private replacePlaceholders(
    section: { html: string } | string,
    p: AgodaProductData,
    platform: BlogType,
    used: Set<string> = new Set(),
  ): string {
    const html = typeof section === 'string' ? section : section.html
    if (!html) return ''
    const hotelImages = p.media?.hotelImages || []
    const topPlaces = p.topPlaces || []
    const normalize = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '')
    const pickImgTag = (src: string, alt: string) => `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" />`

    const matchTag = (raw: string) => {
      const t = raw.trim()
      const parts = t.split(':')
      switch (parts[0]) {
        case '관광지': {
          const name = parts.slice(1).join(':').trim()
          const np = topPlaces.find(tp => normalize(tp.name) === normalize(name) || tp.name.includes(name))
          if (np?.url) {
            const key = `tp|${np.url}`
            if (!used.has(key)) {
              used.add(key)
              return pickImgTag(np.url, np.name)
            }
          }
          return ''
        }
        default: {
          const tag = t
          const candidates = hotelImages.filter(img => this.tagOfHotelImage(img) === tag)
          const pick = candidates.find(c => !used.has(c.url)) || candidates[0]
          if (pick) {
            used.add(pick.url)
            return pickImgTag(pick.url, pick.caption || tag)
          }
          const fallbacks = ['외관', '객실', '레스토랑', '수영장']
          for (const fb of fallbacks) {
            const fcs = hotelImages.filter(img => this.tagOfHotelImage(img) === fb)
            const fp = fcs.find(c => !used.has(c.url)) || fcs[0]
            if (fp) {
              used.add(fp.url)
              return pickImgTag(fp.url, fp.caption || fb)
            }
          }
          return ''
        }
      }
    }

    return html.replace(/\[image:([^\]\|]+)(?:\|[^\]]+)?\]/g, (_m, raw: string) => matchTag(raw))
  }

  // 신규: hotelImages → 태그 매핑
  private tagOfHotelImage(img: { group?: string | null; caption?: string | null }): string | null {
    const text = `${img.group || ''} ${img.caption || ''}`.toLowerCase()
    if (/(수영장|pool)/i.test(text)) return '수영장'
    if (/(피트니스|헬스|gym)/i.test(text)) return '피트니스'
    if (/(레스토랑|다이닝|뷔페|바|라운지)/i.test(text)) return '레스토랑'
    if (/(로비)/i.test(text)) return '로비'
    if (/(조식|breakfast)/i.test(text)) return '조식'
    if (/(욕실|bath)/i.test(text)) return '욕실'
    if (/(전망|view|오션뷰|시티뷰)/i.test(text)) return '전망'
    if (/(객실|룸|bed|침대|suite)/i.test(text)) return '객실'
    if (/(외관|건물|숙소|property)/i.test(text)) return '외관'
    return null
  }

  private getBannerStyle(): string {
    return `<style>
/* 공통 배너 스타일 */
.banner {
  background-color: #ffffff !important;
  border: 1px solid #e0e0e0 !important;
  border-radius: 10px !important;
  overflow: hidden !important;
  box-shadow: 0px 15px 30px 0px rgba(119, 123, 146, 0.1) !important;
  transition: transform 0.2s !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  margin: 8px 0 !important;
  gap: 16px !important;
  padding: 12px !important;
}

/* 배너 프레임 (링크) – 상태별 색상 동일 */
.banner-frame {
  text-decoration: none !important;
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
  color: inherit !important;
  gap: 16px !important;
}

.banner-frame:link,
.banner-frame:visited,
.banner-frame:hover,
.banner-frame:active,
.banner-frame:focus {
  color: inherit !important;
  text-decoration: none !important;
  background: transparent !important;
  outline: none !important;
}

/* 이미지 */
.banner img {
  width: 160px !important;
  height: 160px !important;
  object-fit: cover !important;
  flex-shrink: 0 !important;
}

/* 콘텐츠 영역 */
.banner-content {
  flex: 1 !important;
  min-width: 0 !important; /* 긴 텍스트 줄바꿈 허용 */
}

/* 제목 */
.banner-title {
  font-size: 18px !important;
  font-weight: 700 !important;
  margin: 0 0 6px 0 !important;
  color: #222 !important;
  line-height: 1.35 !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  white-space: normal !important;
  display: block !important;
}

/* 설명 */
.banner-p {
  font-size: 16px !important;
  margin: 0 !important;
  color: #777 !important;
  line-height: 1.5 !important;
  white-space: normal !important;
}

/* 버튼 */
.btn {
  text-decoration: none !important;
  background-color: #6200F4 !important;
  box-shadow: 0px 15px 30px 0px rgba(226, 61, 226, 0.12) !important;
  color: #fff !important;
  padding: 10px 30px !important;
  border-radius: 5px !important;
  font-weight: 900 !important;
  text-align: center !important;
  white-space: nowrap !important;
  margin: 0 10px !important;
  flex-shrink: 0 !important;
  box-sizing: border-box !important;
}

.btn:link,
.btn:visited {
  color: #fff !important;
  background-color: #6200F4 !important;
}

.btn:hover,
.btn:active,
.btn:focus {
  color: #fff !important;
  background-color: #6200F4 !important; /* 눌러도 색상 고정 */
  box-shadow: 0px 15px 30px 0px rgba(226, 61, 226, 0.12) !important;
}

/* 모바일 */
@media (max-width: 768px) {
  .banner {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 12px !important;
  }

  /* 프레임 내부도 세로로 변경 */
  .banner-frame {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 10px !important;
    width: 100% !important;
  }

  .banner img {
    width: 100% !important;
    height: auto !important;
  }

  .banner-content {
    width: 100% !important;
  }

  .banner-title {
    font-size: 17px !important;
    margin-top: 2px !important;
  }

  .banner-p {
    font-size: 15px !important;
  }

  .btn {
    width: 100% !important;
    margin: 6px 0 0 0 !important;
    text-align: center !important;
  }
}

/* 모바일 탭 하이라이트 제거 */
.banner, .banner * {
  -webkit-tap-highlight-color: transparent !important;
}

/* 배너 활성/포커스 시 배경 변화 방지 */
.banner:active,
.banner:focus {
  background: #fff !important;
}

</style> `
  }

  private getContentStyle(): string {
    return `<style>
/* 본문 공통 스타일 */
body, .section { font-family: 'Noto Sans KR', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #000; line-height: 1.8; }
.section h2 { font-size: 1.5em; color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-top: 30px; }
.section h3 { font-size: 1.3em; color: #444; margin-top: 25px; border-left: 4px solid #4CAF50; padding-left: 10px; }
.notice { font-size:12px; color:#999; text-align:center; font-style:italic; margin:10px 0; }
.cta-center { text-align:center; margin:20px 0; }
.cta-btn { display:inline-block; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:15px 40px; border-radius:30px; text-decoration:none; font-size:18px; font-weight:bold; }
.grid-2 { display:grid; grid-template-columns:repeat(2, 1fr); gap:15px; margin:20px 0; }
.grid-3 { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin:20px 0; }
.card { background:#F8F9FA; padding:20px; border-radius:8px; margin:15px 0; }
.pros { background-color:#E8F5E9; padding:15px; border:2px solid #4CAF50; border-radius:12px; }
.cons { background-color:#FFF3E0; padding:15px; border:2px solid #FF9800; border-radius:12px; }
.facts-table { width:100%; border-collapse:collapse; margin:20px 0; }
.facts-table th, .facts-table td { padding:12px; border:1px solid #ddd; }
.facts-table thead tr { background-color:#4CAF50; color:#fff; }
.gallery img { width:100%; height:auto; display:block; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
.hero img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); display:block; margin:0 auto; }
</style>`
  }

  private renderHero(thumbnailUrl: string, platform: BlogType): string {
    if (platform === BlogType.TISTORY) {
      return `<div class="thumbnail-container hero" style="text-align: center; margin-bottom: 20px;">${thumbnailUrl}</div>`
    }
    return `<div class="thumbnail-container hero" style="text-align: center; margin-bottom: 20px;"><img src="${thumbnailUrl}" alt="썸네일" fetchpriority="high" decoding="async" /></div>`
  }

  private renderSection(html: string): string {
    return `<div class="section" style="margin: 20px 0;">${html}</div>`
  }

  private renderNotice(type: 'affiliate' | 'info', text: string): string {
    return `<div class="notice">${text.replace(/\n/g, '<br>')}</div>`
  }

  private renderCTA(label: string, href: string): string {
    return `<div class="cta-center"><a href="${href}" rel="sponsored noopener noreferrer" target="_blank" class="cta-btn">${label}</a></div>`
  }

  private renderGallery(images: string[] = [], platform: BlogType): string {
    if (!images || images.length === 0) return ''
    const gridClass = images.length >= 3 ? 'grid-3' : 'grid-2'
    const items = images
      .map((src, i) => {
        if (platform === BlogType.TISTORY) {
          return `<div>${src}</div>`
        }
        return `<img src="${src}" alt="갤러리 이미지 ${i + 1}" loading="lazy" decoding="async" />`
      })
      .map(inner => `<div>${inner}</div>`)
      .join('')
    return `<div class="gallery ${gridClass}">${items}</div>`
  }

  // 호텔 단위 블록: 소개(제목/어필리)/주요 편의/이미지/리뷰 요약
  private renderHotelBlock(p: AgodaProductData, images: string[], platform: BlogType): string {
    const title = p.title || ''
    const affiliate = p.affiliateUrl || p.originalUrl
    const features = (p.features || []).slice(0, 10)
    const reviewItems = (p.reviews?.positive || []).slice(0, 3)

    const header = `
      <div class="banner">
        <a class="banner-frame" href="${affiliate}" rel="sponsored noopener noreferrer" target="_blank">
          <img src="${p.originImageUrls?.[0] || images?.[0] || ''}" alt="${title}" loading="lazy" decoding="async">
          <div class="banner-content">
            <p class="banner-title">${title}</p>
          </div>
        </a>
        <a class="btn" href="${affiliate}" rel="sponsored noopener noreferrer" target="_blank">가격 확인하기</a>
      </div>`

    const featureHtml = features.length
      ? `<div class="card"><h3>주요 편의시설</h3><ul style="margin:8px 0; padding-left:18px;">${features
          .map(f => `<li>${f}</li>`)
          .join('')}</ul></div>`
      : ''

    const imgs = this.renderGallery(images.length ? images : p.originImageUrls || [], platform)

    const reviewHtml = reviewItems.length
      ? `<div class="card"><h3>실투숙 한줄 후기</h3>${reviewItems
          .map(
            r =>
              `<div style="margin:8px 0;">“${(r.content || '').slice(0, 180)}” <small>— ${
                r.author || '게스트'
              }</small></div>`,
          )
          .join('')}</div>`
      : ''

    return `<section class="section" style="margin:24px 0;">${header}${featureHtml}${imgs}${reviewHtml}</section>`
  }

  // 비교표 (호텔별 핵심 요약 + 어필리에이트 링크)
  private renderHotelComparisonTable(products: AgodaProductData[]): string {
    if (!products || products.length === 0) return ''
    const header = `
      <tr>
        <th>호텔</th>
        <th>위치</th>
        <th>체크인/아웃</th>
        <th>주요 특징</th>
        <th>바로가기</th>
      </tr>`

    const rows = products
      .map(p => {
        const loc = p.location || p.address || ''
        const ci = p.checkIn || ''
        const co = p.checkOut || ''
        const feat = (p.features || []).slice(0, 4).join(', ')
        const link = p.affiliateUrl || p.originalUrl
        return `
          <tr>
            <td>${p.title}</td>
            <td>${loc}</td>
            <td>${ci} / ${co}</td>
            <td>${feat}</td>
            <td><a class="btn" href="${link}" rel="sponsored noopener noreferrer" target="_blank">최저가 보기</a></td>
          </tr>`
      })
      .join('')

    return `<div style="margin:24px 0;">
      <h3>호텔 비교표</h3>
      <div class="table-container" style="overflow-x:auto;">
        <table class="facts-table">
          <thead>${header}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`
  }

  // 업로드된 이미지(flat)를 호텔 개수에 맞춰 균등 분배 시도 (부족 시 원본 URL 보강)
  private groupImagesByProduct(products: AgodaProductData[], flatImages: string[]): string[][] {
    const per: string[][] = products.map(() => [])
    if (!flatImages || flatImages.length === 0) return per
    const quota = Math.max(1, Math.floor(flatImages.length / products.length))
    let idx = 0
    for (let i = 0; i < products.length; i++) {
      for (let k = 0; k < quota && idx < flatImages.length; k++) {
        per[i].push(flatImages[idx++])
      }
      // 이미지가 부족하면 원본으로 채움
      if (per[i].length === 0 && products[i].originImageUrls?.length) per[i].push(products[i].originImageUrls[0])
    }
    return per
  }

  private renderProsCons(prosCons: ProsCons): string {
    const pros = (prosCons.pros || []).map(p => `<li style="margin-bottom:5px; line-height:1.6;">${p}</li>`).join('')
    const cons = (prosCons.cons || []).map(c => `<li style="margin-bottom:5px; line-height:1.6;">${c}</li>`).join('')
    return `
      <div class="grid-2">
        <div class="pros">
          <h3>👍 장점</h3>
          <ul style="padding-left:20px; margin:10px 0;">${pros}</ul>
        </div>
        <div class="cons">
          <h3>👎 개선점</h3>
          <ul style="padding-left:20px; margin:10px 0;">${cons}</ul>
        </div>
      </div>
    `
  }

  private renderFactsTable(facts: Facts): string {
    const rows: [string, string][] = []
    if (facts.checkIn || facts.checkOut)
      rows.push(['체크인/체크아웃', `${facts.checkIn || ''} / ${facts.checkOut || ''}`.trim()])
    if (facts.location) rows.push(['위치', facts.location])
    if (facts.features && facts.features.length) rows.push(['주요 특징', facts.features.join(', ')])
    if (rows.length === 0) return ''
    const trs = rows
      .map(
        (r, i) =>
          `<tr${i % 2 === 0 ? ' style="background-color:#f0f0f0;"' : ''}><td style="padding:10px; border:1px solid #ddd; font-weight:bold;">${r[0]}</td><td style="padding:10px; border:1px solid #ddd;">${r[1]}</td></tr>`,
      )
      .join('')
    return `<div class="table-container" style="overflow-x:auto; margin:20px 0;"><table class="facts-table"><tbody>${trs}</tbody></table></div>`
  }

  private renderHighlightCard(rating?: RatingSummary): string {
    if (!rating) return ''
    const review = typeof rating.reviewCount === 'number' ? ` / 리뷰: ${rating.reviewCount}` : ''
    const highlights = rating.highlights && rating.highlights.length ? `<br>${rating.highlights.join('<br>')}` : ''
    return `<div style="background-color:#FFE5E5; padding:15px; border-radius:8px; margin:15px 0;"><strong>⭐ 실제 투숙 만족도</strong><br>평점: ${rating.score}${review}${highlights}</div>`
  }

  private renderJsonLd({
    base,
    title,
    thumbnailUrl,
    faq,
  }: {
    base: any
    title: string
    thumbnailUrl: string
    faq: FaqItem[]
  }): string {
    const article = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      image: [thumbnailUrl],
      datePublished: new Date().toISOString(),
      dateModified: new Date().toISOString(),
      author: { '@type': 'Person', name: '작성자' },
    }

    const faqPage =
      faq && faq.length > 0
        ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map(i => ({
              '@type': 'Question',
              name: i.question,
              acceptedAnswer: { '@type': 'Answer', text: i.answer },
            })),
          }
        : null

    const productOrBase = { ...base, image: thumbnailUrl }
    const parts = [
      `<script type="application/ld+json">${JSON.stringify(productOrBase)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(article)}</script>`,
    ]
    if (faqPage) parts.push(`<script type="application/ld+json">${JSON.stringify(faqPage)}</script>`)
    return parts.join('\n')
  }

  // 여러 호텔의 hotelImages/topPlaces를 합쳐 placeholder 매칭 풀 생성
  private buildMergedForPlaceholders(products: AgodaProductData[]): AgodaProductData {
    const merged: AgodaProductData = {
      title: '',
      originalUrl: '',
      affiliateUrl: '',
      originImageUrls: [],
      images: [],
      reviews: { positive: [] },
      media: { hotelImages: [] },
      topPlaces: [],
      nearbyPlaces: [],
    }
    const imgSet = new Set<string>()
    for (const p of products) {
      for (const hi of p.media?.hotelImages || []) {
        if (!imgSet.has(hi.url)) {
          imgSet.add(hi.url)
          merged.media!.hotelImages.push(hi)
        }
      }
      for (const tp of p.topPlaces || []) {
        if (!merged.topPlaces!.some(x => `${x.name}|${x.url || ''}` === `${tp.name}|${tp.url || ''}`)) {
          merged.topPlaces!.push(tp)
        }
      }
    }
    return merged
  }

  /**
   * 직렬형 이미지 배치: 섹션당 1개씩 순서대로 배치
   */
  private generateSerialImageDistribution(sections: string[], imageUrls: string[], platform: BlogType): string[] {
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
  private generateEvenImageDistribution(sections: string[], imageUrls: string[], platform: BlogType): string[] {
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
  private generateImageHtml(imageUrl: string, index: number, platform: BlogType): string {
    if (platform === BlogType.TISTORY) {
      // 티스토리의 경우 placeholder 형식 사용
      return `
        <div class="product-image" style="margin: 10px 0;">
          ${imageUrl}
        </div>
      `
    } else {
      // 워드프레스, 구글 블로그의 경우 img 태그 사용
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

  private async generateBlogPostSections(agodaProductData: AgodaProductData): Promise<AgodaBlogPost> {
    this.logger.log(`Gemini로 블로그 콘텐츠 생성 시작`)

    const prompt = `
너는 아고다 호텔 어필리에이트 리뷰 전문 작가야. 아래 입력 호텔을 기반으로 실제 투숙 후기를 녹여 신뢰감 있는 단일 호텔 리뷰를 작성해줘. 예약 링크는 코드로 삽입되니 본문에서는 URL이나 “여기서 예약” 같은 직접 표현은 금지.

문체/톤
- 모바일 최적 문단(2~3문장), 한 문장 2줄 이내
- 담백한 대화체, 과장/이모지 최소화, 객관 근거 위주

콘텐츠 구성(섹션)
1) 도입: 어떤 여행자에게 맞는지 한 문단 요약(호텔명 포함)
2) 위치·접근성: 대중교통/쇼핑/공항 접근성 등
3) 객실·청결/편의: 소음/침구/샤워 등 체감 포인트
4) 직원·서비스: 친절도/응대 일화(있다면)
5) 가격·예약 팁: 조식 옵션/주말·성수기 유의(가격 숫자 표기 금지)
6) 이럴 때 추천/주의: 장점≥3, 단점≥1을 불릿으로
7) 마무리 한줄: 누구에게 특히 추천하는지

작성 규칙
- 링크/가격/재고 직접 표기 금지. “예약 배너 참고” 정도의 간접 표현만 가능
- 섹션은 HTML로, 제목은 별도로 생성
- 각 섹션 100~300자, 전체 1600~2200자 권장
- 반드시 FAQ(3개 이상), 장점/개선점, 요약 카드(평점/하이라이트), 팩트 테이블(체크인/체크아웃/위치/특징), CTA 라벨(상/중/하), 갤러리(최소 3장) 포함
 - 본문에 상황에 맞는 이미지 자리표시자 5~8개 삽입: [image:외관|객실|수영장|피트니스|레스토랑|로비|조식|전망|욕실] 또는 [image:관광지:{이름}]
 - 같은 태그 과다 반복 금지, 문맥과 모순되는 태그 금지

출력 스키마
- thumbnailText(1~3줄, 6자/줄 이내)
- title(호텔명/지역/핵심 장점 포함, 클릭 유도형)
- sections(HTML 조각 배열)
- jsonLD(Product)
- tags(검색 유입 키워드)
- faq(자주 묻는 질문, 3개 이상)
- prosCons(장점/개선점)
- ratingSummary(평점/리뷰수/하이라이트)
- facts(체크인/체크아웃/위치/특징)
- ctas(상/중/하 배치용 CTA 라벨)
- gallery(갤러리 이미지 URL)
- tables(필요 시 테이블)

[입력 호텔]
제목: ${agodaProductData.title}
리뷰 샘플: ${JSON.stringify(agodaProductData.reviews.positive)}
주요 관광지(참고용): ${(agodaProductData.topPlaces || [])
      .map(p => p.name)
      .slice(0, 8)
      .join(', ')}
`

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
            faq: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } },
                required: ['question', 'answer'],
              },
              minItems: 3,
            },
            prosCons: {
              type: Type.OBJECT,
              properties: {
                pros: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 3 },
                cons: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 1 },
              },
              required: ['pros', 'cons'],
            },
            ratingSummary: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                reviewCount: { type: Type.NUMBER },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['score'],
            },
            facts: {
              type: Type.OBJECT,
              properties: {
                checkIn: { type: Type.STRING },
                checkOut: { type: Type.STRING },
                location: { type: Type.STRING },
                features: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            ctas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  hrefText: { type: Type.STRING },
                  position: { type: Type.STRING },
                },
                required: ['label', 'hrefText'],
              },
            },

            tables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  rows: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { label: { type: Type.STRING }, value: { type: Type.STRING } },
                      required: ['label', 'value'],
                    },
                  },
                },
                required: ['rows'],
              },
            },
          },
          required: ['thumbnailText', 'sections', 'faq', 'prosCons'],
          propertyOrdering: ['thumbnailText', 'sections'],
        },
      },
    })

    const result = JSON.parse(resp.text) as AgodaBlogPost

    return result
  }

  /**
   * 6. 지정된 블로그로 발행 (티스토리, 워드프레스)
   */
  private async publishToBlog(blogPostData: AgodaBlogPostPublish): Promise<{ url: string }> {
    try {
      this.logger.log(`${blogPostData.platform} 블로그 발행 시작`)

      let publishedUrl: string

      switch (blogPostData.platform as BlogType) {
        case BlogType.TISTORY:
          // 티스토리: 계정의 기본 발행 상태 반영
          const tistoryAccount = await this.prisma.tistoryAccount.findUnique({
            where: { id: blogPostData.accountId as number },
          })
          const tistoryVisibility = tistoryAccount?.defaultVisibility === 'private' ? 'private' : 'public'
          const tistoryResult = await this.tistoryService.publishPost(blogPostData.accountId as number, {
            title: blogPostData.title,
            contentHtml: blogPostData.contentHtml,
            thumbnailPath: blogPostData.localThumbnailUrl,
            keywords: blogPostData.tags,
            category: blogPostData.category,
            postVisibility: tistoryVisibility,
          })
          publishedUrl = tistoryResult.url
          break
        case BlogType.WORDPRESS:
          // 워드프레스: 계정의 기본 발행 상태를 status에 반영
          const wpAccount = await this.prisma.wordPressAccount.findUnique({
            where: { id: blogPostData.accountId as number },
          })
          let wpStatus = 'publish'
          switch (wpAccount?.defaultVisibility) {
            case 'private':
              wpStatus = 'private'
              break
            case 'publish':
              wpStatus = 'publish'
              break
            case 'public':
            default:
              wpStatus = 'publish'
              break
          }
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
            status: wpStatus,
            tags: tagIds,
            categories: categoryIds,
            featuredMediaId,
          })
          publishedUrl = wordpressResult.url
          break
        case BlogType.GOOGLE_BLOG:
          // Google Blogger는 bloggerBlogId와 oauthId가 필요하므로 accountId를 bloggerAccountId로 사용
          const bloggerAccount = await this.prisma.bloggerAccount.findUnique({
            where: { id: blogPostData.accountId as number },
          })

          assert(bloggerAccount, `Blogger 계정을 찾을 수 없습니다: ${blogPostData.accountId}`)

          // 블로거: 계정의 기본 발행 상태가 private이면 draft로 발행
          const isDraft = bloggerAccount.defaultVisibility === 'private'
          const googleResult = await this.googleBloggerService.publish(
            {
              title: blogPostData.title,
              content: blogPostData.contentHtml,
              bloggerBlogId: bloggerAccount.bloggerBlogId,
              oauthId: bloggerAccount.googleOauthId,
            },
            { isDraft },
          )
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
   * 플랫폼별 계정 사전 준비 (로그인/인증 상태 확인 및 처리)
   */
  private async preparePlatformAccount(platform: BlogType, accountId: number | string): Promise<void> {
    this.logger.log(`${platform} 계정 사전 준비 시작: ${accountId}`)

    switch (platform) {
      case BlogType.TISTORY:
        await this.prepareTistoryAccount(accountId as number)
        break
    }

    this.logger.log(`${platform} 계정 사전 준비 완료: ${accountId}`)
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

    const { browser } = await this.tistoryAutomationService.initializeBrowserWithLogin({
      kakaoId: tistoryAccount.loginId,
      kakaoPw: tistoryAccount.loginPassword,
      tistoryUrl: tistoryAccount.tistoryUrl,
    })
    await browser.close()
  }

  /**
   * 권한 체크
   */
  private async checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()

    if (!settings.licenseCache?.isValid) {
      throw new CustomHttpException(ErrorCode.LICENSE_INVALID, {
        message: '라이센스가 유효하지 않습니다.',
      })
    }

    if (!settings.licenseCache.permissions.includes(permission)) {
      throw new CustomHttpException(ErrorCode.LICENSE_PERMISSION_DENIED, {
        permissions: [permission],
      })
    }
  }
}
