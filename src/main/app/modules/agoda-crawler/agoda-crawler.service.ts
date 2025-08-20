import { Injectable, Logger } from '@nestjs/common'
import { Browser, chromium, Page } from 'playwright'
import { EnvConfig } from '@main/config/env.config'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { retry } from '@main/app/utils'
import axios from 'axios'
import {
  AgodaCrawlerOptions,
  AgodaProductData,
  AgodaReview,
  AgodaReviewApiResponse,
} from '@main/app/modules/agoda-crawler/agoda-crawler.types'

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
    let page: Page | null = null
    try {
      page = await this.createPage()

      // GraphQL(property) 인터셉트 결과 수집 버퍼
      const gqlPackets: Array<{ op?: string; variables?: any; data?: any }> = []
      // 리뷰 API 인터셉트 결과 수집 버퍼
      const reviewPackets: Array<{ body?: any; data?: AgodaReviewApiResponse }> = []

      // 아고다 GraphQL(property) 요청/응답 가로채기
      await page.route('**/graphql/property', async route => {
        const req = route.request()

        // 요청 본문 파싱 (operationName, variables 추출 용도)
        let op: string | undefined
        let variables: any | undefined
        try {
          const raw = req.postData()
          if (raw) {
            const body = JSON.parse(raw)
            op = body?.operationName
            variables = body?.variables
          }
        } catch {}

        // 실제 서버에 전달 후 응답 선열람
        const res = await route.fetch()
        let json: any
        try {
          json = await res.json()
        } catch {
          try {
            json = JSON.parse(await res.text())
          } catch {
            json = undefined
          }
        }

        gqlPackets.push({ op, variables, data: json })

        // 페이지에도 동일 응답 전달
        await route.fulfill({ response: res })
      })

      // 아고다 리뷰 API 요청/응답 가로채기
      await page.route('**/api/cronos/property/review/HotelReviews', async route => {
        const req = route.request()

        // body 파싱 (필요 시 PageNumber 등 확인 용도)
        let body: any
        try {
          const raw = req.postData()
          body = raw ? JSON.parse(raw) : undefined
        } catch {}

        const res = await route.fetch()
        let json: any
        try {
          json = await res.json()
        } catch {
          try {
            json = JSON.parse(await res.text())
          } catch {
            json = undefined
          }
        }

        reviewPackets.push({ body, data: json as AgodaReviewApiResponse })

        await route.fulfill({ response: res })
      })

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

            // 페이지 상의 스크립트가 GraphQL 호출을 수행할 수 있도록 잠시 대기
            // (호텔 상세 진입 직후 주요 쿼리 수집 목적)
            await page.waitForTimeout(2000)
            try {
              // 한 번 더 보장 – 첫 번째 성공 응답 대기 (타임아웃 짧게)
              await page.waitForResponse(
                resp => resp.url().includes('/graphql/property') && resp.request().method() === 'POST',
                { timeout: 4000 },
              )
              await page.waitForResponse(
                resp =>
                  resp.url().includes('/api/cronos/property/review/HotelReviews') && resp.request().method() === 'POST',
                { timeout: 4000 },
              )
            } catch {}

            // GraphQL 응답에서 핵심 데이터 추출 (제목/이미지/가격)
            const gqlExtract = this.extractFromGraphQLPackets(gqlPackets)

            // 제목(호텔명) – GraphQL → 페이지 타이틀 순
            const pageTitle = await page.title()
            const title = gqlExtract.title || pageTitle

            // 대표 이미지 – GraphQL → DOM 수집 순
            const domImages: string[] = await page.$$eval('img', nodes =>
              Array.from(new Set(nodes.map(n => n.getAttribute('src') || '').filter(Boolean))),
            )
            const imageCandidates = this.ensureUniqueStrings([...(gqlExtract.images || []), ...domImages])
            const images: string[] = this.normalizeAgodaImageUrls(imageCandidates.slice(0, 20))

            // 리뷰 데이터: 인터셉트 데이터 우선, 없으면 폴백(axios 재호출)
            let reviews = [] as AgodaReview[]
            const lastReview = reviewPackets[reviewPackets.length - 1]
            if (lastReview?.data) {
              reviews = this.mapReviewsFromApiResponse(lastReview.data)
            } else {
              reviews = await this.extractAgodaReviews(page)
            }

            return {
              title,
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

  // GraphQL 응답 배열에서 상품 핵심 데이터 추출
  private extractFromGraphQLPackets(packets: Array<{ op?: string; variables?: any; data?: any }>): {
    title?: string
    images: string[]
  } {
    const images: string[] = []
    let title: string | undefined
    let price: number | undefined

    for (const p of packets) {
      const d = p?.data?.data || p?.data
      if (!d) continue

      // 호텔 상세 후보 객체들 탐색
      const candidates: any[] = []
      if (d.property) candidates.push(d.property)
      if (d.hotel) candidates.push(d.hotel)
      if (d.propertyById) candidates.push(d.propertyById)
      if (Array.isArray(d.properties)) candidates.push(...d.properties)
      if (d.searchResult?.properties) candidates.push(...(d.searchResult.properties as any[]))
      // propertyDetailsSearch 경로 처리
      if (Array.isArray(d?.propertyDetailsSearch?.propertyDetails)) {
        candidates.push(...d.propertyDetailsSearch.propertyDetails)
      }

      for (const c of candidates) {
        if (!title) {
          title =
            c?.contentSummary?.displayName ||
            c?.contentSummary?.localeName ||
            c?.nameKorean ||
            c?.name ||
            c?.hotelName ||
            c?.title
        }

        // 이미지 수집: 다양한 필드명 케이스를 고려
        const imgs: string[] = []
        const fromImages = Array.isArray(c?.images) ? c.images : []
        const fromGallery = Array.isArray(c?.gallery) ? c.gallery : []
        const fromPhotos = Array.isArray(c?.photos) ? c.photos : []
        const fromMedia = Array.isArray(c?.media) ? c.media : []
        const fromHotelImages = Array.isArray(c?.contentDetail?.contentImages?.hotelImages)
          ? c.contentDetail.contentImages.hotelImages
          : []

        for (const item of [...fromImages, ...fromGallery, ...fromPhotos, ...fromMedia]) {
          const u = item?.url || item?.src || item?.imageUrl || item?.path
          if (typeof u === 'string' && u) imgs.push(u)
        }
        for (const item of fromHotelImages) {
          const urls = Array.isArray(item?.urls) ? item.urls : []
          for (const kv of urls) {
            const v = kv?.value
            if (typeof v === 'string' && v) imgs.push(v)
          }
        }
        images.push(...imgs)

        // 가격은 현재 미사용 (요청에 따라 수집만 유지 가능)
      }
    }

    return { title, images: this.ensureUniqueStrings(images) }
  }

  private ensureUniqueStrings(list: string[]): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of list) {
      if (!s) continue
      if (seen.has(s)) continue
      seen.add(s)
      out.push(s)
    }
    return out
  }

  private normalizeAgodaImageUrls(urls: string[]): string[] {
    return urls.map(u => {
      if (!u) return u
      if (u.startsWith('//')) return `https:${u}`
      return u
    })
  }

  private mapReviewsFromApiResponse(payload: AgodaReviewApiResponse): AgodaReview[] {
    const comments: any[] = payload?.commentList?.comments || []
    return comments.slice(0, 10).map(c => ({
      content: c.reviewComments || c.originalComment || '',
      rating: Number(c.rating) || 0,
      author: c.reviewerInfo?.displayMemberName || '',
      date: c.reviewDate || c.formattedReviewDate || '',
    }))
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
