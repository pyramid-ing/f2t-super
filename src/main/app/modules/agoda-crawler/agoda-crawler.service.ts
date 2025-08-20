import { Injectable, Logger } from '@nestjs/common'
import { Browser, chromium, Page } from 'playwright'
import { EnvConfig } from '@main/config/env.config'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { retry } from '@main/app/utils'
import axios from 'axios'
import { AgodaCrawlerOptions, AgodaProductData, AgodaReview } from '@main/app/modules/agoda-crawler/agoda-crawler.types'

// AgodaCrawlerError 클래스 정의
export class AgodaCrawlerErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'AgodaCrawlerError'
  }
}

@Injectable()
export class AgodaCrawlerService {
  private readonly logger = new Logger(AgodaCrawlerService.name)
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
   * Agoda 상세페이지: 프론트 스크립트가 저장해둔 리뷰 API 페이로드를 사용해 리뷰를 수집
   */
  private async extractAgodaReviews(page: Page): Promise<AgodaReview[]> {
    // 페이지에서 캡처 payload만 수집
    const evalResult = await page.evaluate(() => {
      const cap: any = (window as any).__agoda_review_capture__
      return { body: cap?.body || null, href: location.href }
    })

    if (!evalResult?.body) {
      throw new AgodaCrawlerErrorClass({ code: 'CAPTURE_NOT_READY', message: '리뷰 캡처 payload가 없습니다.' })
    }

    let payload: any = {}
    try {
      payload = JSON.parse(evalResult.body)
      payload.PageNumber = payload.PageNumber || 1
    } catch {
      payload = evalResult.body
    }

    const apiUrl = new URL('/api/cronos/property/review/HotelReviews', evalResult.href).toString()
    const cookieHeader = await this.buildCookieHeader(page)

    const res = await axios.post(apiUrl, payload, {
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        cookie: cookieHeader,
      },
      timeout: 15000,
      validateStatus: () => true,
    })

    if (res.status < 200 || res.status >= 300) {
      throw new AgodaCrawlerErrorClass({ code: 'HTTP_ERROR', message: `HTTP ${res.status}` })
    }

    const comments: any[] = res.data?.commentList?.comments || []
    const mapped: AgodaReview[] = comments.slice(0, 10).map(c => ({
      content: c.reviewComments || c.originalComment || '',
      rating: Number(c.rating) || 0,
      author: c.reviewerInfo?.displayMemberName || '',
      date: c.reviewDate || c.formattedReviewDate || '',
    }))
    return mapped
  }

  /**
   * 브라우저 인스턴스를 가져옵니다.
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: EnvConfig.getPlaywrightHeadless(),
        executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--lang=ko-KR,ko',
          '--password-store=basic',
          '--use-mock-keychain',
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

    // 실제 브라우저 UA 사용, 한국어 우선 헤더만 적용
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9',
    })

    // 뷰포트 설정
    await page.setViewportSize({ width: 1920, height: 1080 })

    return page
  }

  private async buildCookieHeader(page: Page): Promise<string> {
    const url = new URL(page.url())
    const cookies = await page.context().cookies(url.origin)
    return cookies.map(c => `${c.name}=${c.value}`).join('; ')
  }

  /**
   * 상품 정보 크롤링
   */
  async crawlProductInfo(agodaUrl: string, options: AgodaCrawlerOptions = {}): Promise<AgodaProductData> {
    await this.checkPermission(Permission.USE_COUPANG_PARTNERS)

    let page: Page | null = null
    try {
      page = await this.createPage()

      // 최대 3회 페이지 갱신 기반 재시도 (util.retry 사용)
      let isFirstAttempt = true
      try {
        const result = await retry(
          async () => {
            if (isFirstAttempt) {
              await page.goto(agodaUrl, { waitUntil: 'load' })
              isFirstAttempt = false
            } else {
              this.logger.warn('페이지 새로고침 재시도')
              await page.reload({ waitUntil: 'load' })
            }

            // 제목(호텔명)
            const title = await page.title()

            // 대표 이미지 시도 (있으면)
            const images: string[] = await page.$$eval('img', nodes =>
              Array.from(new Set(nodes.map(n => n.getAttribute('src') || '').filter(Boolean))),
            )

            // 리뷰 데이터 (프론트 캡처 재호출)
            const reviews = await this.extractAgodaReviews(page)

            return {
              title,
              price: 0,
              originalUrl: agodaUrl,
              affiliateUrl: '',
              originImageUrls: images,
              images,
              reviews: { positive: reviews },
            }
          },
          1000,
          3,
          'exponential',
        )

        return result
      } catch (retryError) {
        throw new AgodaCrawlerErrorClass({
          code: 'CRAWLING_RETRY_EXHAUSTED',
          message: '페이지 새로고침 재시도 후에도 필수 데이터를 가져오지 못했습니다.',
          details: retryError,
        })
      }
    } catch (error) {
      this.logger.error('상품 정보 크롤링 실패:', error)
      if (error instanceof AgodaCrawlerErrorClass) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: `상품 정보 크롤링에 실패했습니다. ${error.message}`,
      })
    } finally {
      if (page) {
        await page.close()
      }
    }
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
