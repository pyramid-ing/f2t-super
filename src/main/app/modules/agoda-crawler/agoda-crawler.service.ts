import { Injectable, Logger } from '@nestjs/common'
import { Browser, chromium, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { EnvConfig } from '@main/config/env.config'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { retry } from '@main/app/utils'
import axios from 'axios'
import dayjs from 'dayjs'
import {
  AgodaCrawlerOptions,
  AgodaProductData,
  AgodaReview,
  AgodaReviewApiResponse,
} from '@main/app/modules/agoda-crawler/agoda-crawler.types'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

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
   * 아고다 검색 결과 크롤링
   * - 검색 페이지 진입 → 검색어 입력 → 자동완성 첫 항목 선택 → 결과 목록에서 {title, url} 수집
   * - 날짜 파라미터는 오늘 기준 1달 이내로 설정
   */
  async search(keyword: string, limit: number = 5): Promise<Array<{ title: string; url: string }>> {
    let page: Page | null = null
    try {
      const today = dayjs()
      let checkIn = today.add(7, 'day')
      const latest = today.add(30, 'day')
      if (checkIn.isAfter(latest)) checkIn = latest

      let checkOut = checkIn.add(3, 'day')
      if (checkOut.isAfter(latest)) {
        const maxNights = Math.max(1, Math.min(10, latest.diff(checkIn, 'day')))
        checkOut = checkIn.add(maxNights, 'day')
      }

      const toYmd = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD')

      const baseUrl = new URL(
        'https://www.agoda.com/ko-kr/search?city=19041&locale=ko-kr&prid=0&currency=KRW&userId=14e67e45-cb9e-4015-92b3-daa59e9e99ed&whitelabelid=1&loginLvl=0&storefrontId=3&currencyId=26&currencyCode=KRW&htmlLanguage=ko-kr&cultureInfoName=ko-kr&aid=347227&useFullPageLogin=true&cttp=4&isRealUser=true&mode=production',
      )
      baseUrl.searchParams.set('locale', 'ko-kr')
      baseUrl.searchParams.set('adults', '2')
      baseUrl.searchParams.set('children', '0')
      baseUrl.searchParams.set('rooms', '1')
      baseUrl.searchParams.set('checkIn', toYmd(checkIn))
      baseUrl.searchParams.set('checkOut', toYmd(checkOut))
      baseUrl.searchParams.set('priceCur', 'KRW')

      page = await this.createPage()

      const results = await retry(
        async () => {
          // 페이지 진입 자체를 재시도 내에서 수행
          await page!.goto(baseUrl.toString(), { waitUntil: 'load' })

          // 검색 입력 클릭 및 키워드 입력
          const inputSelector = '[data-selenium="textInput"]#textInput'
          await page!.waitForSelector('[data-selenium="autocomplete-box"]', { timeout: 15000 })
          await page!.click('[data-selenium="autocomplete-box"]')
          await page!.waitForSelector(inputSelector, { timeout: 10000 })
          await page!.fill(inputSelector, keyword)

          // 자동완성: 도시/지역/명소만 필터링하여 첫 번째 항목 클릭. 실패 시 Enter 폴백
          try {
            await page!.waitForSelector('button#destination_suggestion_card[data-selenium="autosuggest-item"]', {
              timeout: 6000,
            })
            const locator = page!.locator(
              [
                'button#destination_suggestion_card[data-selenium="autosuggest-item"][data-element-name="web-autosuggest-maincity-prefilled"]',
                'button#destination_suggestion_card[data-selenium="autosuggest-item"][data-element-name="web-autosuggest-area-prefilled"]',
                'button#destination_suggestion_card[data-selenium="autosuggest-item"][data-element-name="web-autosuggest-landmark-prefilled"]',
              ].join(', '),
            )
            const count = await locator.count()
            if (count > 0) {
              await locator.first().click()
            } else {
              // 두 번째 패턴: ul.AutocompleteList 기반 – 도시(1)/지역(4)/명소(16)만 클릭
              const pattern2Selector = [
                'ul.AutocompleteList li[data-selenium="autosuggest-item"][data-element-place-type="1"]',
                'ul.AutocompleteList li[data-selenium="autosuggest-item"][data-element-place-type="4"]',
                'ul.AutocompleteList li[data-selenium="autosuggest-item"][data-element-place-type="16"]',
              ].join(', ')
              const pat2 = await page!.$(pattern2Selector)
              if (pat2) {
                await pat2.click()
              } else {
                // 최후 폴백: 첫 항목 또는 Enter
                const anyLegacy = await page!.$('ul.AutocompleteList li[data-selenium="autosuggest-item"]')
                if (anyLegacy) {
                  await anyLegacy.click()
                } else {
                  await page!.keyboard.press('Enter')
                }
              }
            }
          } catch {
            await page!.keyboard.press('Enter')
          }

          // 검색 버튼 클릭 (가능하면 버튼 우선) - 실패 시 Enter 폴백
          try {
            await page!.waitForSelector('[data-selenium="searchButton"][data-element-name="search-button"]', {
              timeout: 6000,
            })
            await page!.click('[data-selenium="searchButton"][data-element-name="search-button"]')
          } catch {
            await page!.keyboard.press('Enter')
          }

          // 결과 로드 대기
          await page!.waitForTimeout(500)
          try {
            await page!.waitForSelector('a.PropertyCard__Link', { timeout: 8000 })
          } catch {}

          // 스크롤로 추가 로드 (필요 시)
          const collected: Array<{ title: string; url: string }> = []
          let seen = 0
          for (let attempt = 0; attempt < 6 && collected.length < limit; attempt++) {
            // DOM에서 결과 수집
            const batch = await page!.$$eval('a.PropertyCard__Link', (anchors: Element[]) => {
              const items: Array<{ title: string; url: string }> = []
              for (const node of anchors) {
                const a = node as HTMLAnchorElement
                const href = a.getAttribute('href') || ''
                const titleEl = a.querySelector(
                  '[data-selenium="hotel-name"], h3[data-selenium="hotel-name"]',
                ) as HTMLElement | null
                const rawTitle = (titleEl?.textContent || a.getAttribute('aria-label') || '').trim()
                if (!href || !rawTitle) continue
                const abs = href.startsWith('http') ? href : 'https://www.agoda.com' + href
                items.push({ title: rawTitle, url: abs })
              }
              return items
            })
            // 중복 제거 및 누적
            for (const item of batch) {
              if (collected.find(r => r.url === item.url)) continue
              collected.push(item)
              if (collected.length >= limit) break
            }

            // 더 필요하면 스크롤
            if (collected.length < limit) {
              const before = seen
              seen = collected.length
              await page!.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
              await page!.waitForTimeout(800)
              // 증가 없으면 한 번 더 미세 스크롤
              if (seen === before) {
                await page!.evaluate(() => window.scrollBy(0, 1200))
                await page!.waitForTimeout(600)
              }
            }
          }

          if (collected.length === 0) {
            throw new Error('NO_RESULTS')
          }
          return collected
        },
        1000,
        3,
        'exponential',
      )

      return results.slice(0, limit)
    } catch (error) {
      this.logger.error('아고다 검색 크롤링 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED, {
        message: '아고다 검색 크롤링에 실패했습니다.',
      })
    } finally {
      if (page) {
        await page.close()
      }
    }
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

            // 이미지 로컬 저장(WebP 변환)
            let processedImages: string[] = []
            if (options.processImages !== false) {
              try {
                processedImages = await this.processImages(images)
              } catch (e) {
                this.logger.warn('이미지 로컬 처리 실패, 원본 URL 사용으로 폴백', e)
              }
            }

            return {
              title,
              originalUrl: agodaUrl,
              affiliateUrl: '',
              originImageUrls: images,
              images: processedImages.length > 0 ? processedImages : images,
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
   * 이미지를 다운로드하고 WebP로 변환합니다.
   */
  private async downloadAndConvertImage(imageUrl: string, index: number): Promise<string> {
    try {
      const tempDir = path.join(EnvConfig.tempDir, 'agoda-images')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      assert(fs.existsSync(tempDir), '임시 디렉토리 생성에 실패했습니다')

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      })

      assert(response.status === 200, `이미지 다운로드 실패: ${response.status}`)
      if (response.status !== 200) {
        throw new Error(`이미지 다운로드 실패: ${response.status}`)
      }

      const imageBuffer = Buffer.from(response.data)
      const processedImageBuffer = await sharp(imageBuffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

      const timestamp = Date.now()
      const filename = `agoda_${timestamp}_${index}.webp`
      const filepath = path.join(tempDir, filename)

      fs.writeFileSync(filepath, processedImageBuffer)

      return filepath
    } catch (error) {
      this.logger.error(`이미지 처리 실패 (${imageUrl}):`, error)
      throw new AgodaCrawlerErrorClass({
        code: 'IMAGE_PROCESSING_FAILED',
        message: '이미지 처리에 실패했습니다.',
        details: error,
      })
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
        processedImages.push(imageUrls[i])
      }
    }

    return processedImages
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
