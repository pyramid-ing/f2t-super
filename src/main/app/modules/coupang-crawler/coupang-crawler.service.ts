import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import axios from 'axios'
import { CoupangProductData, CoupangReview, CoupangCrawlerOptions } from './coupang-crawler.types'
import { EnvConfig } from '@main/config/env.config'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

// CoupangCrawlerError 클래스 정의
class CoupangCrawlerErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'CoupangCrawlerError'
  }
}

@Injectable()
export class CoupangCrawlerService {
  private readonly logger = new Logger(CoupangCrawlerService.name)
  private browser: Browser | null = null

  constructor(private readonly settingsService: SettingsService) {}

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

  /**
   * 브라우저 인스턴스를 가져옵니다.
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: false,
        executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--lang=ko-KR,ko',
        ],
      })
    }
    return this.browser
  }

  /**
   * 새로운 페이지를 생성합니다.
   */
  private async createPage(): Promise<Page> {
    const browser = await this.getBrowser()
    const page = await browser.newPage()

    // User-Agent 설정
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })

    // 뷰포트 설정
    await page.setViewportSize({ width: 1920, height: 1080 })

    return page
  }

  /**
   * 이미지를 다운로드하고 WebP로 변환합니다.
   */
  private async downloadAndConvertImage(imageUrl: string, index: number): Promise<string> {
    try {
      // 임시 디렉토리 생성

      const tempDir = path.join(EnvConfig.tempDir, 'coupang-images')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      assert(fs.existsSync(tempDir), '임시 디렉토리 생성에 실패했습니다')

      // 이미지 다운로드
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      })

      assert(response.status === 200, `이미지 다운로드 실패: ${response.status}`)

      if (response.status !== 200) {
        throw new Error(`이미지 다운로드 실패: ${response.status}`)
      }

      // 이미지 처리 및 WebP 변환
      const imageBuffer = Buffer.from(response.data)
      const processedImageBuffer = await sharp(imageBuffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

      // 파일명 생성 (타임스탬프 + 인덱스)
      const timestamp = Date.now()
      const filename = `coupang_${timestamp}_${index}.webp`
      const filepath = path.join(tempDir, filename)

      // 파일 저장
      fs.writeFileSync(filepath, processedImageBuffer)

      return filepath
    } catch (error) {
      this.logger.error(`이미지 처리 실패 (${imageUrl}):`, error)
      throw new CoupangCrawlerErrorClass({
        code: 'IMAGE_PROCESSING_FAILED',
        message: '이미지 처리에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 상품 정보 크롤링
   */
  async crawlProductInfo(coupangUrl: string, options: CoupangCrawlerOptions = {}): Promise<CoupangProductData> {
    await this.checkPermission(Permission.USE_COUPANG_PARTNERS)

    let page: Page | null = null
    try {
      page = await this.createPage()

      // 쿠팡 상품 페이지로 이동
      await page.goto(coupangUrl, { waitUntil: 'networkidle' })

      // 상품 정보 추출
      const title = await this.extractProductTitle(page)
      const price = await this.extractProductPrice(page)
      const images = await this.extractProductImages(page)
      const reviews = await this.extractProductReviews(page)

      // 이미지 처리 (옵션에 따라)
      let processedImages: string[] = []
      if (options.processImages !== false) {
        processedImages = await this.processImages(images)
      }

      return {
        title,
        price,
        originalUrl: coupangUrl,
        affiliateUrl: '', // 어필리에이트 링크는 별도로 생성
        originImageUrls: images,
        images: processedImages.length > 0 ? processedImages : images,
        reviews,
      }
    } catch (error) {
      this.logger.error('상품 정보 크롤링 실패:', error)
      throw new CoupangCrawlerErrorClass({
        code: 'CRAWLING_FAILED',
        message: '상품 정보 크롤링에 실패했습니다.',
        details: error,
      })
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  /**
   * 이미지들을 다운로드하고 WebP로 변환합니다.
   */
  private async processImages(imageUrls: string[]): Promise<string[]> {
    const processedImages: string[] = []

    assert(imageUrls.length > 0, '처리할 이미지가 없습니다')

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const processedPath = await this.downloadAndConvertImage(imageUrls[i], i)
        processedImages.push(processedPath)
      } catch (error) {
        this.logger.warn(`이미지 처리 실패 (${i + 1}/${imageUrls.length}):`, error)
        processedImages.push(imageUrls[i]) // 실패 시 원본 URL 사용
      }
    }

    return processedImages
  }

  /**
   * 상품 제목을 추출합니다.
   */
  private async extractProductTitle(page: Page): Promise<string> {
    try {
      // 쿠팡 실제 제목 선택자
      const titleElement = await page.$('h1.product-title')

      assert(titleElement, '상품 제목 요소를 찾을 수 없습니다')

      if (titleElement) {
        const title = await titleElement.textContent()

        assert(title, '상품 제목 텍스트를 가져올 수 없습니다')

        if (title && title.trim()) {
          return title.trim()
        }
      }

      throw new Error('상품 제목을 찾을 수 없습니다.')
    } catch (error) {
      this.logger.warn('상품 제목 추출 실패:', error)
      return '상품 제목'
    }
  }

  /**
   * 상품 가격을 추출합니다.
   */
  private async extractProductPrice(page: Page): Promise<number> {
    try {
      // 쿠팡 실제 가격 선택자
      const priceElement = await page.$('.final-price-amount')

      assert(priceElement, '상품 가격 요소를 찾을 수 없습니다')

      if (priceElement) {
        const priceText = await priceElement.textContent()

        assert(priceText, '상품 가격 텍스트를 가져올 수 없습니다')

        if (priceText) {
          // 숫자만 추출
          const price = priceText.replace(/[^\d]/g, '')
          if (price) {
            return parseInt(price, 10)
          }
        }
      }

      throw new Error('상품 가격을 찾을 수 없습니다.')
    } catch (error) {
      this.logger.warn('상품 가격 추출 실패:', error)
      return 0
    }
  }

  /**
   * 상품 이미지를 추출합니다.
   */
  private async extractProductImages(page: Page): Promise<string[]> {
    try {
      // 쿠팡 실제 이미지 선택자
      const imageElements = await page.$$('.product-image li img')

      assert(imageElements.length > 0, '상품 이미지를 찾을 수 없습니다')

      const images: string[] = []

      for (const element of imageElements) {
        const src = await element.getAttribute('src')
        if (src) {
          // //로 시작하는 경우 https: 추가
          let processedSrc = src
          if (src.startsWith('//')) {
            processedSrc = `https:${src}`
          } else if (!src.startsWith('http')) {
            processedSrc = `https://${src}`
          }

          // 48x48ex를 1000x1000ex로 변경
          const highResSrc = processedSrc.replace(/48x48ex/g, '1000x1000ex')
          if (!images.includes(highResSrc)) {
            images.push(highResSrc)
          }
        }
      }

      return images
    } catch (error) {
      this.logger.warn('상품 이미지 추출 실패:', error)
      return []
    }
  }

  /**
   * 상품 리뷰를 추출합니다.
   */
  private async extractProductReviews(page: Page): Promise<{
    positive: CoupangReview[]
  }> {
    try {
      // 리뷰 섹션으로 스크롤
      await page.evaluate(() => {
        const reviewSection = document.querySelector('.js_reviewArticleReviewList')
        if (reviewSection) {
          reviewSection.scrollIntoView({ behavior: 'smooth' })
        }
      })

      // 리뷰가 로드될 때까지 대기
      await page.waitForTimeout(3000)

      // 좋은 리뷰 필터 클릭 및 추출
      const positiveReviews = await this.extractReviewsByFilter(page)

      assert(positiveReviews.length > 0, '리뷰 데이터를 찾을 수 없습니다')

      return {
        positive: positiveReviews.slice(0, 5),
      }
    } catch (error) {
      this.logger.warn('리뷰 추출 실패:', error)
      return { positive: [] }
    }
  }

  /**
   * 필터를 클릭하고 해당 리뷰들을 추출합니다.
   */
  private async extractReviewsByFilter(page: Page): Promise<CoupangReview[]> {
    // 리뷰 데이터 추출
    return await page.$$eval('.sdp-review__article__list.js_reviewArticleReviewList', nodes =>
      nodes.map(node => ({
        author: node.querySelector('.sdp-review__article__list__info__user__name')?.textContent?.trim() || '익명',
        date: node.querySelector('.sdp-review__article__list__info__product-info__reg-date')?.textContent?.trim() || '',
        content: node.querySelector('.sdp-review__article__list__review')?.textContent?.trim() || '리뷰 내용',
        rating: parseInt(
          node
            .querySelector('.sdp-review__article__list__info__product-info__star-orange')
            ?.getAttribute('data-rating'),
          10,
        ),
      })),
    )
  }

  /**
   * 브라우저를 종료합니다.
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  /**
   * 서비스 종료 시 정리
   */
  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser()
  }
}
