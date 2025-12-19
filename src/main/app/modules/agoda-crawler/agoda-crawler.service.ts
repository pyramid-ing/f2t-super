import { Injectable, Logger } from '@nestjs/common'
import { Browser, chromium, Page } from 'patchright'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { EnvConfig } from '@main/config/env.config'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { retry } from '@main/app/utils'
import { BrowserErrorHandler } from '@main/app/utils/browser-error-handler'
import { SettingsService } from '@main/app/modules/settings/settings.service'
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

  constructor(
    private readonly browserErrorHandler: BrowserErrorHandler,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * 아고다 검색 결과 크롤링
   * - 검색 페이지 진입 → 검색어 입력 → 자동완성 첫 항목 선택 → 결과 목록에서 {title, url} 수집
   * - 날짜 파라미터는 오늘 기준 1달 이내로 설정
   */
  public async search(keyword: string, limit: number = 5): Promise<Array<{ title: string; url: string }>> {
    try {
      // textSearchResult 페이지로 직접 진입하여 호텔만 수집
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

      const interstitialUrl = new URL('https://www.agoda.com/ko-kr/pages/agoda/default/page_textSearchResult.aspx')
      interstitialUrl.searchParams.set('locale', 'ko-kr')
      interstitialUrl.searchParams.set('textToSearch', keyword)
      interstitialUrl.searchParams.set('adults', '2')
      interstitialUrl.searchParams.set('children', '0')
      interstitialUrl.searchParams.set('rooms', '1')
      interstitialUrl.searchParams.set('checkIn', toYmd(checkIn))
      interstitialUrl.searchParams.set('checkOut', toYmd(checkOut))
      interstitialUrl.searchParams.set('priceCur', 'KRW')

      return await this._searchHotelsFromInterstitial(interstitialUrl.toString(), limit)
    } catch (error) {
      this.logger.error('아고다 검색 크롤링 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED, {
        message: '아고다 검색 크롤링에 실패했습니다.',
      })
    }
  }

  /**
   * 상품 정보 크롤링
   */
  public async crawlProductInfo(agodaUrl: string, options: AgodaCrawlerOptions = {}): Promise<AgodaProductData> {
    let page: Page | null = null
    try {
      page = await this._createPage()

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
            const gqlExtract = this._extractFromGraphQLPackets(gqlPackets)

            // 제목(호텔명) – GraphQL → 페이지 타이틀 순
            const pageTitle = await page.title()
            const title = gqlExtract.title || pageTitle

            // 대표 이미지 – GraphQL → DOM 수집 순
            // 이미지 URL 평탄화 수집 로직은 media.hotelImages로 대체

            // 리뷰 데이터: 인터셉트 데이터 우선, 없으면 폴백(axios 재호출)
            let reviews = [] as AgodaReview[]
            const lastReview = reviewPackets[reviewPackets.length - 1]
            if (lastReview?.data) {
              reviews = this._mapReviewsFromApiResponse(lastReview.data)
            } else {
              reviews = await this._extractAgodaReviews(page)
            }

            // 이미지 로컬 저장(WebP 변환)
            // 이미지 로컬 다운로드는 상위 서비스에서 필요 시 수행

            // 사실 정보/편의정보 추가 추출
            const { checkIn, checkOut } = await this._extractCheckInOut(page)
            const location = await this._extractLocation(page)
            const address = await this._extractAddress(page)
            const features = await this._extractFeatures(page)
            const { airportTransit, publicTransit, nearbyAmenities, proximityHighlights } =
              await this._extractTransit(page)
            const description = await this._extractDescription(page)

            return {
              title,
              originalUrl: agodaUrl,
              affiliateUrl: '',
              // 이미지 목록은 media.hotelImages로 제공
              reviews: { positive: reviews },
              description,
              checkIn,
              checkOut,
              location,
              features,
              address,
              airportTransit,
              publicTransit,
              nearbyAmenities,
              proximityHighlights,
              // 구조화된 미디어/주변/관광지
              media: { hotelImages: this._extractStructuredFromGraphQLPackets(gqlPackets).hotelImages },
              topPlaces: this._extractStructuredFromGraphQLPackets(gqlPackets).topPlaces,
              nearbyPlaces: this._extractStructuredFromGraphQLPackets(gqlPackets).nearbyPlaces,
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
   * Agoda 상세페이지: 프론트 스크립트가 저장해둔 리뷰 API 페이로드를 사용해 리뷰를 수집
   */
  private async _extractAgodaReviews(page: Page): Promise<AgodaReview[]> {
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
    const cookieHeader = await this._buildCookieHeader(page)

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
  private async _getBrowser(): Promise<Browser> {
    if (!this.browser) {
      try {
        const headless = await this.settingsService.getPlaywrightHeadless()
        this.browser = await chromium.launch({
          headless,
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
      } catch (error) {
        this.browserErrorHandler.handleBrowserError(error)
      }
    }
    return this.browser
  }

  /**
   * 새로운 페이지를 생성합니다.
   */
  private async _createPage(): Promise<Page> {
    const browser = await this._getBrowser()
    const page = await browser.newPage()

    // 실제 브라우저 UA 사용, 한국어 우선 헤더만 적용
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9',
    })

    // 뷰포트 설정
    await page.setViewportSize({ width: 1920, height: 1080 })

    return page
  }

  private async _buildCookieHeader(page: Page): Promise<string> {
    const url = new URL(page.url())
    const cookies = await page.context().cookies(url.origin)
    return cookies.map(c => `${c.name}=${c.value}`).join('; ')
  }

  /**
   * 아고다 Interstitial 검색 결과 페이지에서 호텔만 수집
   * - 입력 URL로 바로 진입하여 ol.InterstitialList 안의 li.hotel 항목만 추출
   */
  private async _searchHotelsFromInterstitial(
    listPageUrl: string,
    limit: number = 5,
  ): Promise<Array<{ title: string; url: string }>> {
    let page: Page | null = null
    try {
      page = await this._createPage()

      const results = await retry(
        async () => {
          await page!.goto(listPageUrl, { waitUntil: 'load' })

          try {
            await page!.waitForSelector('ol.InterstitialList', { timeout: 8000 })
          } catch {}

          const hotels = await page!.$$eval(
            'ol.InterstitialList li.hotel.InterstitialList__item a.InterstitialList__container',
            (anchors: Element[], max: number) => {
              const out: Array<{ title: string; url: string }> = []
              for (const node of anchors) {
                if (out.length >= max) break
                const a = node as HTMLAnchorElement
                const href = a.getAttribute('href') || ''
                const h3 = a.querySelector('h3.InterstitialList__title') as HTMLElement | null
                const span = h3?.querySelector('span') as HTMLElement | null
                const rawTitle = (span?.textContent || h3?.textContent || a.getAttribute('aria-label') || '').trim()
                if (!href || !rawTitle) continue
                const abs = href.startsWith('http') ? href : new URL(href, location.origin).toString()
                out.push({ title: rawTitle, url: abs })
              }
              return out
            },
            limit,
          )

          if (!hotels || hotels.length === 0) {
            throw new Error('NO_HOTEL_RESULTS')
          }
          // 각 호텔 URL을 실제 접속하여 리디렉션 최종 URL로 교체
          const browser = await (async () => this._getBrowser())()
          const resolveCtx = await browser.newContext({
            extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9' },
            viewport: { width: 1280, height: 800 },
          })
          try {
            const limited = hotels.slice(0, limit)
            const resolved: Array<{ title: string; url: string }> = []
            for (const item of limited) {
              let finalUrl = item.url
              const p = await resolveCtx.newPage()
              try {
                const resp = await p.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 })
                try {
                  await p.waitForLoadState('load', { timeout: 10000 })
                } catch {}
                finalUrl = p.url() || resp?.url() || item.url
              } catch {
              } finally {
                await p.close()
              }
              resolved.push({ title: item.title, url: finalUrl })
            }
            return resolved
          } finally {
            await resolveCtx.close()
          }
        },
        1000,
        3,
        'exponential',
      )

      return results
    } catch (error) {
      this.logger.error('아고다 Interstitial 검색 수집 실패:', error)
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED, {
        message: '아고다 Interstitial 검색 결과 수집에 실패했습니다.',
      })
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  // GraphQL 응답 배열에서 상품 핵심 데이터 추출
  private _extractFromGraphQLPackets(packets: Array<{ op?: string; variables?: any; data?: any }>): {
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

    return { title, images: this._ensureUniqueStrings(images) }
  }

  private _ensureUniqueStrings(list: string[]): string[] {
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

  // GraphQL packets에서 구조화 이미지/주변/관광지 추출
  private _extractStructuredFromGraphQLPackets(packets: Array<{ op?: string; variables?: any; data?: any }>): {
    hotelImages: Array<{ id: number; group?: string | null; caption?: string | null; url: string }>
    topPlaces: Array<{ name: string; distanceInKm?: number; url?: string }>
    nearbyPlaces: Array<{ name: string; distanceInKm?: number; typeName?: string }>
  } {
    const hotelImages: Array<{ id: number; group?: string | null; caption?: string | null; url: string }> = []
    const topPlaces: Array<{ name: string; distanceInKm?: number; url?: string }> = []
    const nearbyPlaces: Array<{ name: string; distanceInKm?: number; typeName?: string }> = []

    for (const p of packets) {
      const d = p?.data?.data || p?.data
      if (!d) continue
      const details = d?.propertyDetailsSearch?.propertyDetails
      if (!Array.isArray(details)) continue

      for (const c of details) {
        // hotelImages(main)
        const imgs = c?.contentDetail?.contentImages?.hotelImages || []
        for (const img of imgs) {
          const main = Array.isArray(img?.urls) ? img.urls.find((u: any) => u?.key === 'main') : undefined
          const value = main?.value
          if (!value) continue
          const url = value.startsWith('http') ? value : `https:${value}`
          hotelImages.push({ id: img.id, group: img.group ?? img.groupId, caption: img.caption, url })
        }

        // topPlaces(main)
        const tps = Array.isArray(c?.topPlaces) ? c.topPlaces : []
        for (const tp of tps) {
          let url: string | undefined
          const img0 = tp?.images?.[0]
          const kv = img0?.urls?.find((u: any) => u?.key === 'main')
          if (kv?.value) url = kv.value.startsWith('http') ? kv.value : `https:${kv.value}`
          topPlaces.push({ name: tp?.name, distanceInKm: tp?.distanceInKm, url })
        }

        // nearbyPlaces
        const nps = Array.isArray(c?.nearbyPlaces) ? c.nearbyPlaces : []
        for (const np of nps) {
          nearbyPlaces.push({ name: np?.name, distanceInKm: np?.distanceInKm, typeName: np?.typeName })
        }
      }
    }

    // 중복 제거
    const uniq = <T>(arr: T[], key: (t: T) => string) => {
      const seen = new Set<string>()
      const out: T[] = []
      for (const it of arr) {
        const k = key(it)
        if (seen.has(k)) continue
        seen.add(k)
        out.push(it)
      }
      return out
    }

    return {
      hotelImages: uniq(hotelImages, i => `${i.id}|${i.url}`),
      topPlaces: uniq(topPlaces, p => `${p.name}|${p.url || ''}`),
      nearbyPlaces: uniq(nearbyPlaces, n => `${n.name}|${n.typeName || ''}`),
    }
  }

  private async _extractCheckInOut(page: Page): Promise<{ checkIn?: string; checkOut?: string }> {
    try {
      const text = await page.$$eval('*', nodes => nodes.map(n => (n as HTMLElement).innerText).join('\n'))
      const ci = /체크인\s*[:|-]?\s*(\d{1,2}:\d{2}|오전\s*\d+|오후\s*\d+|\d{1,2}시)/i.exec(text)?.[1]
      const co = /체크아웃\s*[:|-]?\s*(\d{1,2}:\d{2}|오전\s*\d+|오후\s*\d+|\d{1,2}시)/i.exec(text)?.[1]
      return { checkIn: ci || undefined, checkOut: co || undefined }
    } catch {
      return {}
    }
  }

  private async _extractLocation(page: Page): Promise<string | undefined> {
    try {
      const loc = await page.$('[data-selenium="hotel-area"], [class*="Location"], .hotel-area')
      const txt = (await loc?.textContent())?.trim()
      return txt || undefined
    } catch {
      return undefined
    }
  }

  private async _extractAddress(page: Page): Promise<string | undefined> {
    try {
      const addr = await page.$('[data-selenium="hotel-address"], [class*="address"], .hotel-address')
      const txt = (await addr?.textContent())?.replace(/\s+/g, ' ').trim()
      return txt || undefined
    } catch {
      return undefined
    }
  }

  private async _extractFeatures(page: Page): Promise<string[] | undefined> {
    try {
      const feats = await page.$$eval('[data-selenium="amenities"] li, .amenities li, [class*="Facility"] li', nodes =>
        nodes.map(n => (n as HTMLElement).innerText.trim()).filter(Boolean),
      )
      return feats.length ? Array.from(new Set(feats)).slice(0, 20) : undefined
    } catch {
      return undefined
    }
  }

  private async _extractTransit(page: Page): Promise<{
    airportTransit?: string
    publicTransit?: string
    nearbyAmenities?: string[]
    proximityHighlights?: string[]
  }> {
    try {
      const airport = (await (await page.$('[class*="airport"], .airport-info'))?.textContent())?.trim()
      const publicT = (await (await page.$('[class*="public-transport"], .transport-info'))?.textContent())?.trim()
      const nearby = await page.$$eval('[class*="nearby"], .nearby li', nodes =>
        nodes.map(n => (n as HTMLElement).innerText.trim()).filter(Boolean),
      )
      const highlights = await page.$$eval('[class*="distance"], .distance', nodes =>
        nodes.map(n => (n as HTMLElement).innerText.trim()).filter(Boolean),
      )
      return {
        airportTransit: airport || undefined,
        publicTransit: publicT || undefined,
        nearbyAmenities: nearby.length ? Array.from(new Set(nearby)).slice(0, 10) : undefined,
        proximityHighlights: highlights.length ? Array.from(new Set(highlights)).slice(0, 10) : undefined,
      }
    } catch {
      return {}
    }
  }

  private async _extractDescription(page: Page): Promise<string | undefined> {
    try {
      // 숙소 소개 모달/섹션 텍스트 수집 (첨부 예시 기준)
      const selectors = [
        '[data-selenium="hotel-description"], .hotel-description, .PropertyDescription, [class*="Description"]',
      ]
      for (const sel of selectors) {
        const el = await page.$(sel)
        const txt = (await el?.textContent())?.replace(/\s+/g, ' ').trim()
        if (txt && txt.length > 60) return txt
      }
      // 대체: 전체 텍스트에서 숙소 소개 구간 탐색
      const full = await page.$$eval('*', nodes => nodes.map(n => (n as HTMLElement).innerText).join('\n'))
      const match = /숙소 소개[\s\S]{0,20}\n([\s\S]{60,800})/i.exec(full)
      return match?.[1]?.replace(/\s+/g, ' ').trim()
    } catch {
      return undefined
    }
  }

  private _mapReviewsFromApiResponse(payload: AgodaReviewApiResponse): AgodaReview[] {
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
  private async _downloadAndConvertImage(imageUrl: string, index: number): Promise<string> {
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
   * 브라우저를 종료합니다.
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}
