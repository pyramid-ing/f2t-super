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
import { CoupangBlogJob } from '@prisma/client'
import {
  CoupangBlogPostJobStatus,
  CoupangBlogPostJobResponse,
  CoupangBlogPost,
  CoupangBlogPostPublish,
} from './coupang-blog-post-job.types'
import { CreateCoupangBlogPostJobDto } from './dto/create-coupang-blog-post-job.dto'
import { UpdateCoupangBlogPostJobDto } from './dto/update-coupang-blog-post-job.dto'
import { CoupangAffiliateLink } from '@main/app/modules/coupang-partners/coupang-partners.types'
import { Type } from '@google/genai'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { JobStatus, IndexProvider, IndexStatus, JobTargetType } from '@main/app/modules/job/job.types'
import { IndexJobService } from '@main/app/modules/job/index-job/index-job.service'
import { Browser, chromium, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { EnvConfig } from '@main/config/env.config'
import { CoupangProductData } from '@main/app/modules/coupang-crawler/coupang-crawler.types'
import { StorageService } from '@main/app/modules/google/storage/storage.service'
import { UtilService } from '@main/app/modules/util/util.service'
import axios from 'axios'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
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
    private readonly storageService: StorageService,
    private readonly utilService: UtilService,
  ) {}

  /**
   * 쿠팡 URL 표준화 (워크플로우 서비스와 동일한 로직)
   */
  private normalizeCoupangUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim()
    assert(trimmed.length > 0, '쿠팡 URL이 비어있습니다.')

    let url: URL
    try {
      const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      url = new URL(withScheme)
    } catch {
      assert(false, `유효하지 않은 URL입니다: ${rawUrl}`)
    }

    const hostname = url.hostname.toLowerCase()
    switch (hostname) {
      case 'www.coupang.com':
      case 'coupang.com':
      case 'link.coupang.com':
        break
      default:
        assert(false, `쿠팡 도메인이 아닙니다: ${hostname}`)
    }

    let productId = ''
    const pathMatch = url.pathname.match(/\/vp\/products\/(\d+)/)
    if (pathMatch && pathMatch[1]) {
      productId = pathMatch[1]
    }
    if (!productId) {
      const pageKey = url.searchParams.get('pageKey')
      if (pageKey && /^\d+$/.test(pageKey)) {
        productId = pageKey
      }
    }

    const itemId = url.searchParams.get('itemId') || ''
    const vendorItemId = url.searchParams.get('vendorItemId') || ''

    assert(/^\d+$/.test(productId), `productId가 유효하지 않습니다: ${productId || 'N/A'}`)
    assert(/^\d+$/.test(itemId), `itemId가 유효하지 않습니다: ${itemId || 'N/A'}`)
    assert(/^\d+$/.test(vendorItemId), `vendorItemId가 유효하지 않습니다: ${vendorItemId || 'N/A'}`)

    return `https://www.coupang.com/vp/products/${productId}?itemId=${itemId}&vendorItemId=${vendorItemId}`
  }

  /**
   * 쿠팡 블로그 포스트 작업 처리 (메인 프로세스)
   */
  public async processJob(jobId: string): Promise<{ resultUrl?: string; resultMsg: string }> {
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

      // 대상 URL들 준비 (단일/비교 공용)
      const urls: string[] = Array.isArray(coupangBlogJob.coupangUrls) ? (coupangBlogJob.coupangUrls as string[]) : []
      const isComparison = urls.length > 1

      // 쿠팡 크롤링 + 어필리에이트 (다건)
      await this.jobLogsService.log(jobId, `쿠팡 상품 정보 수집 시작 (${urls.length}개)`)
      const products = await this.crawlMultipleProducts(urls)
      await this.jobLogsService.log(jobId, '쿠팡 상품 정보 수집 완료')

      // 블로그 포스트 생성
      await this.jobLogsService.log(jobId, 'AI 블로그 내용 생성 시작')
      const blogPost = isComparison
        ? await this.generateBlogPostSectionsForComparison(products)
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
        category: coupangBlogJob.category,
        tags: blogPost.tags,
      })
      const publishedUrl = publishResult.url
      await this.jobLogsService.log(jobId, `${platform} 블로그 발행 완료`)

      // 발행 완료 시 DB 업데이트
      await this.prisma.coupangBlogJob.update({
        where: { jobId },
        data: {
          coupangAffiliateLink: isComparison ? undefined : products[0].affiliateUrl,
          title: blogPost.title,
          content: contentHtml,
          tags: blogPost.tags,
          resultUrl: publishedUrl,
          status: CoupangBlogPostJobStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      })

      this.logger.log(`쿠팡 블로그 포스트 작업 완료: ${jobId}`)
      await this.jobLogsService.log(jobId, '쿠팡 블로그 포스트 작업 완료')

      // 인덱싱 작업 자동 생성
      if (publishedUrl) {
        try {
          const domain = new URL(publishedUrl).hostname.replace(/^www\./, '')
          const site = await (this.prisma as any).site.findUnique({ where: { domain } })
          if (site) {
            const normalizedUrl = IndexJobService.normalizeUrl(publishedUrl)
            const activeEngines: IndexProvider[] = []
            const google = JSON.parse(site.googleConfig || '{}')
            const bing = JSON.parse(site.bingConfig || '{}')
            const naver = JSON.parse(site.naverConfig || '{}')
            const daum = JSON.parse(site.daumConfig || '{}')
            if (google?.use) activeEngines.push(IndexProvider.GOOGLE)
            if (bing?.use) activeEngines.push(IndexProvider.BING)
            if (naver?.use) activeEngines.push(IndexProvider.NAVER)
            if (daum?.use) activeEngines.push(IndexProvider.DAUM)
            for (const provider of activeEngines) {
              await (this.prisma as any).index.upsert({
                where: { url_provider: { url: normalizedUrl, provider } },
                update: {},
                create: {
                  url: normalizedUrl,
                  provider,
                  siteId: site.id,
                  status: IndexStatus.REQUEST,
                  indexedAt: new Date(),
                },
              })
              await this.prisma.job.create({
                data: {
                  targetType: JobTargetType.INDEX,
                  subject: `인덱싱 요청: ${normalizedUrl}`,
                  desc: `포스팅 발행 완료 자동 인덱싱 | INDEX_PROVIDER=${provider}`,
                  status: JobStatus.REQUEST,
                  priority: 1,
                  scheduledAt: new Date(),
                },
              })
            }
          }
        } catch {}
      }

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
      if (error instanceof CustomHttpException) throw error
      throw new CustomHttpException(ErrorCode.COUPANG_PARTNERS_LINK_FAILED)
    }
  }

  /**
   * 계정 설정 확인 및 플랫폼 결정
   */
  private validateBlogAccount(coupangBlogJob: CoupangBlogJob): {
    platform: 'tistory' | 'wordpress' | 'google_blog'
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
        platform: 'google_blog',
        accountId: coupangBlogJob.bloggerAccountId,
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
  private async uploadImages(
    imagePaths: string[],
    platform: 'tistory' | 'wordpress' | 'google_blog',
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
        case 'google_blog':
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
    return typeof (uploadResult as any) === 'string' ? (uploadResult as any) : uploadResult.url
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
  }: {
    products: CoupangProductData[]
    sections: string[]
    imageUrls: string[]
    thumbnailUrl: string
    jsonLD: any
    platform: 'tistory' | 'wordpress' | 'google_blog'
    imageDistributionType?: 'serial' | 'even'
  }): string {
    this.logger.log('비교형 HTML 조합 시작')

    const thumbnailHtml =
      platform === 'tistory'
        ? `<div class="thumbnail-container" style="text-align: center; margin-bottom: 20px;">${thumbnailUrl}</div>`
        : `<div class="thumbnail-container" style="text-align: center; margin-bottom: 20px;"><img src="${thumbnailUrl}" alt="썸네일" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" /></div>`

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

    const productCards = products
      .map(
        (p, i) => `
      <div class="banner">
        <a class="banner-frame" href="${p.affiliateUrl}" rel="sponsored noopener" target="_blank">
          <img src="${p.originImageUrls[0]}" alt="${p.title}">
          <div class="banner-content">
            <p class="banner-title">${i + 1}. ${p.title}</p>
          </div>
        </a>
        <a class="btn" href="${p.affiliateUrl}" rel="sponsored noopener" target="_blank">최저가 보기</a>
      </div>`,
      )
      .join('')

    const combinedSectionHtml = sections
      .map(
        (section, index) => `
      <div class="section" style="margin: 20px 0;">
        ${section}
        ${sectionImagesHtml[index] || ''}
        
        ${productCards}
      </div>`,
      )
      .join('')

    const style = this.getBannerStyle()

    const coupangAnnounce = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'

    const jsonLdScript = `<script type="application/ld+json">\n${JSON.stringify(
      { ...jsonLD, image: thumbnailUrl },
      null,
      2,
    )}\n</script>`

    const html = `
      ${style}
      ${thumbnailHtml}
      ${combinedSectionHtml}
      ${coupangAnnounce}
      ${jsonLdScript}
    `

    this.logger.log('비교형 HTML 조합 완료')
    return html
  }

  private async generateBlogPostSectionsForComparison(
    products: CoupangProductData[],
  ): Promise<CoupangBlogPost & { title: string }> {
    this.logger.log('Gemini로 비교형 콘텐츠 생성 시작')

    const minimalProducts = products.map(p => ({
      title: p.title,
      review: p.reviews?.positive?.[0] || null,
    }))

    const prompt = `
는 쿠팡 파트너스로 수익을 창출하는 블로거를 위한 여러 상품 비교 리뷰 작성 도우미야.
리뷰는 실제 사용자가 직접 경험한 것처럼 자연스럽고 신뢰감 있게 구성되어야 하며, 구매 유도와 클릭률을 높이는 글쓰기 방식을 적용해야 해.
사용자가 상품 리뷰를 작성할 때 아래 정보를 제공하면, 이를 바탕으로 아래 구조에 따라 1500~2000자 정도의 리뷰 콘텐츠를 작성해줘

구매링크에 대한 언급은 필요없어. 내가 별도로 추가할거야.

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

[입력 상품]
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
          },
          required: ['thumbnailText', 'sections'],
          propertyOrdering: ['thumbnailText', 'sections'],
        },
      },
    })

    const result = JSON.parse(resp.text) as CoupangBlogPost
    return result
  }

  private async uploadAllImages(
    products: CoupangProductData[],
    localThumbnailUrl: string,
    platform: 'tistory' | 'wordpress' | 'google_blog',
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

  private async crawlMultipleProducts(urls: string[]): Promise<CoupangProductData[]> {
    const products = await Promise.all(
      urls.map(async url => {
        const affiliateUrl = await this.createAffiliateLink(url)
        const data = await this.crawlCoupangProduct(url)
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
    platform: 'tistory' | 'wordpress' | 'google_blog'
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

    const style = this.getBannerStyle()

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

  private getBannerStyle(): string {
    return `<style>
/* 공통 배너 스타일 */
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
  margin: 8px 0;
  gap: 16px;
  padding: 12px;
}

/* 배너 프레임 (링크) – 상태별 색상 동일 */
.banner-frame {
  text-decoration: none;
  display: flex;
  align-items: center;
  width: 100%;
  color: inherit;
  gap: 16px;
}

.banner-frame:link,
.banner-frame:visited,
.banner-frame:hover,
.banner-frame:active,
.banner-frame:focus {
  color: inherit;
  text-decoration: none;
  background: transparent;
  outline: none;
}

/* 이미지 */
.banner img {
  width: 160px;
  height: 160px;
  object-fit: cover;
  flex-shrink: 0;
}

/* 콘텐츠 영역 */
.banner-content {
  flex: 1;
  min-width: 0;              /* 긴 텍스트 줄바꿈 허용 */
}

/* 제목 */
.banner-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: #222;
  line-height: 1.35;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
  display: block;
}

/* 설명 */
.banner-p {
  font-size: 16px;
  margin: 0;
  color: #777;
  line-height: 1.5;
  white-space: normal;
}

/* 버튼 */
.btn {
  text-decoration: none !important;
  background-color: #6200F4;
  box-shadow: 0px 15px 30px 0px rgba(226, 61, 226, 0.12);
  color: #fff;
  padding: 10px 30px;
  border-radius: 5px;
  font-weight: 900;
  text-align: center;
  white-space: nowrap;
  margin: 0 10px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.btn:link,
.btn:visited {
  color: #fff;
  background-color: #6200F4;
}

.btn:hover,
.btn:active,
.btn:focus {
  color: #fff;
  background-color: #6200F4; /* 눌러도 색상 고정 */
  box-shadow: 0px 15px 30px 0px rgba(226, 61, 226, 0.12);
}

/* 모바일 */
@media (max-width: 768px) {
  .banner {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  /* 프레임 내부도 세로로 변경 */
  .banner-frame {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    width: 100%;
  }

  .banner img {
    width: 100%;
    height: auto;
  }

  .banner-content {
    width: 100%;
  }

  .banner-title {
    font-size: 17px;
    margin-top: 2px;
  }

  .banner-p {
    font-size: 15px;
  }

  .btn {
    width: 100%;
    margin: 6px 0 0 0;
    text-align: center;
  }
}

/* 모바일 탭 하이라이트 제거 */
.banner, .banner * {
  -webkit-tap-highlight-color: transparent;
}

/* 배너 활성/포커스 시 배경 변화 방지 */
.banner:active,
.banner:focus {
  background: #fff;
}

</style> `
  }

  /**
   * 직렬형 이미지 배치: 섹션당 1개씩 순서대로 배치
   */
  private generateSerialImageDistribution(
    sections: string[],
    imageUrls: string[],
    platform: 'tistory' | 'wordpress' | 'google_blog',
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
    platform: 'tistory' | 'wordpress' | 'google_blog',
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
  private generateImageHtml(
    imageUrl: string,
    index: number,
    platform: 'tistory' | 'wordpress' | 'google_blog',
  ): string {
    if (platform === 'tistory') {
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
  private async publishToBlog(blogPostData: CoupangBlogPostPublish): Promise<{ url: string }> {
    try {
      this.logger.log(`${blogPostData.platform} 블로그 발행 시작`)

      let publishedUrl: string

      switch (blogPostData.platform) {
        case 'tistory':
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
        case 'wordpress':
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
        case 'google_blog':
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
   * CoupangBlogPostJob 생성
   */
  async createCoupangBlogPostJob(jobData: CreateCoupangBlogPostJobDto): Promise<CoupangBlogPostJobResponse> {
    try {
      const normalizedUrls = Array.from(new Set((jobData.coupangUrls || []).map(u => this.normalizeCoupangUrl(u))))
      // Job 생성
      const job = await this.prisma.job.create({
        data: {
          targetType: JobTargetType.COUPANG_REVIEW_POSTING,
          subject: jobData.subject,
          desc: jobData.desc,
          status: jobData.immediateRequest ? JobStatus.REQUEST : JobStatus.PENDING,
          priority: jobData.priority || 1,
          scheduledAt: jobData.scheduledAt ? new Date(jobData.scheduledAt) : new Date(),
        },
      })

      // CoupangBlogJob 생성
      const coupangBlogJob = await this.prisma.coupangBlogJob.create({
        data: {
          coupangUrls: normalizedUrls,
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
      coupangUrls: coupangBlogJob.coupangUrls as string[],
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
    platform: 'tistory' | 'wordpress' | 'google_blog',
    accountId: number | string,
  ): Promise<void> {
    this.logger.log(`${platform} 계정 사전 준비 시작: ${accountId}`)

    switch (platform) {
      case 'tistory':
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

    const { browser } = await this.tistoryAutomationService.initializeBrowserWithLogin(
      tistoryAccount.loginId,
      tistoryAccount.tistoryUrl,
    )
    await browser.close()
  }
}
