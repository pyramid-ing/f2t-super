import fs from 'node:fs'
import path from 'node:path'
import { SiteConfigService } from '@main/app/modules/site-config/site-config.service'
import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, Page } from 'playwright'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

export interface DaumIndexerOptions {
  urlsToIndex: string[]
  siteId?: number // siteId 추가 (사이트별 설정 우선 사용)
  siteUrl?: string // 옵션으로 변경
  pin?: string // 옵션으로 변경: DB에서 가져올 수 있음
}

@Injectable()
export class DaumIndexerService {
  private readonly logger = new Logger(DaumIndexerService.name)

  constructor(private readonly siteConfigService: SiteConfigService) {}

  private async getDaumConfig(siteId?: number, siteUrl?: string) {
    try {
      if (siteId) {
        try {
          const siteConfig = await this.siteConfigService.getSiteConfig(siteId)

          if (siteConfig.daumConfig && siteConfig.daumConfig.use) {
            const config = siteConfig.daumConfig

            if (!config.siteUrl) {
              throw new CustomHttpException(ErrorCode.DAUM_CONFIG_DISABLED, { siteId, hasSiteUrl: false })
            }

            if (!config.password) {
              throw new CustomHttpException(ErrorCode.DAUM_AUTH_FAIL, { siteId, hasPinCode: false })
            }

            return {
              siteUrl: config.siteUrl,
              password: config.password,
              headless: config.headless ?? true,
            }
          }
        } catch (error) {
          this.logger.log(`사이트별 Daum 설정을 사용할 수 없음, 글로벌 설정으로 fallback: ${error.message}`)
        }
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.DAUM_UNKNOWN_ERROR, { siteId, errorMessage: error.message })
    }
  }

  private getDaumCookiePath(siteUrl?: string) {
    const cookieDir = process.env.COOKIE_DIR
    if (!fs.existsSync(cookieDir)) fs.mkdirSync(cookieDir, { recursive: true })
    const safeSite = (siteUrl || 'default').replace(/[^\w\-]/g, '_')
    return path.join(cookieDir, `daum_${safeSite}.json`)
  }

  private async loadCookies(page: Page, siteUrl?: string) {
    const cookiePath = this.getDaumCookiePath(siteUrl)
    if (fs.existsSync(cookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'))
      await page.context().addCookies(cookies)
      this.logger.log('쿠키를 불러와 세션을 복원합니다.')
      return true
    }
    return false
  }

  private async saveCookies(page: Page, siteUrl?: string) {
    const cookiePath = this.getDaumCookiePath(siteUrl)
    const cookies = await page.context().cookies()
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf-8')
    this.logger.log('쿠키를 저장했습니다.')
  }

  async submitUrl(siteId: number, url: string): Promise<{ success: boolean; message: string }> {
    const siteConfig = await this.siteConfigService.getSiteConfig(siteId)
    if (!siteConfig || !siteConfig.daumConfig) {
      throw new CustomHttpException(ErrorCode.DAUM_CONFIG_DISABLED, { siteId })
    }
    const daumSiteUrl = siteConfig.daumConfig.siteUrl
    const pin = siteConfig.daumConfig.password
    const useHeadless = false
    const browser: Browser = await chromium.launch({
      headless: useHeadless,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    })
    const page: Page = await browser.newPage()

    // 쿠키 불러오기
    await this.loadCookies(page, daumSiteUrl)

    await page.goto('https://webmaster.daum.net/tool/collect')
    await sleep(1000)
    const isLoginPage = await page.$('form.form_register input#authSiteUrl')
    if (isLoginPage) {
      if (!daumSiteUrl || !pin) {
        await browser.close()
        throw new CustomHttpException(ErrorCode.DAUM_AUTH_FAIL, {
          siteId,
          daumSiteUrl,
          errorMessage: '로그인 필요: siteUrl, pin 값을 설정하거나 입력하세요.',
        })
      }
      await page.fill('#authSiteUrl', daumSiteUrl)
      await page.fill('#authPinCode', pin)
      await page.click('button.btn_register')
      await page.waitForURL('https://webmaster.daum.net/dashboard', { waitUntil: 'networkidle', timeout: 20000 })
      if ((await page.url()).startsWith('https://webmaster.daum.net/login')) {
        await browser.close()
        throw new CustomHttpException(ErrorCode.DAUM_AUTH_FAIL, {
          siteId,
          daumSiteUrl,
          errorMessage: 'Daum 로그인 실패: URL 또는 PIN 코드가 올바르지 않습니다.',
        })
      }
      this.logger.log('다음 로그인 완료')
      if ((await page.url()).includes('/dashboard')) {
        await page.goto('https://webmaster.daum.net/tool/collect', { waitUntil: 'networkidle' })
        await sleep(2000)
      }
      // 로그인 성공 시 쿠키 저장
      await this.saveCookies(page, daumSiteUrl)
    } else {
      this.logger.warn('로그인 폼이 감지되지 않음, 이미 로그인된 상태일 수 있음')
    }
    await page.waitForSelector('#collectReqUrl', { timeout: 10000 })
    await page.evaluate(() => {
      const input = document.querySelector('#collectReqUrl') as HTMLInputElement
      if (input) input.value = ''
    })
    await page.fill('#collectReqUrl', url)
    await page.click('.btn_result')
    await sleep(2000)
    let isSuccess = false
    let msg = ''
    let errorFromDesc = ''
    const timeoutMs = 10000
    const pollInterval = 300
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      isSuccess = await page.evaluate(() => {
        const layer = document.querySelector('.webmaster_layer.layer_collect')
        return layer && !layer.classList.contains('hide')
      })
      if (!isSuccess) {
        errorFromDesc = await page.evaluate(() => {
          const descElement = document.querySelector('p.desc')
          return descElement ? descElement.textContent?.trim() || '' : ''
        })
      }
      if (isSuccess || errorFromDesc) break
      await sleep(pollInterval)
    }
    if (isSuccess) {
      msg = '수집요청 완료'
      await page.click('.btn_confirm')
      await sleep(500)
      await browser.close()
      return { success: true, message: msg }
    } else {
      msg = errorFromDesc || '수집요청 실패 또는 레이어 미노출'
      // desc 메시지에 따라 중복 URL, 과도한 호출 에러 분기
      await browser.close()
      if (msg.includes('중복 URL')) {
        throw new CustomHttpException(ErrorCode.DAUM_DUPLICATE_URL, { siteId, daumSiteUrl, errorMessage: msg })
      }
      // 잘못된 URL 입력시 에러 처리
      if (msg.includes('올바른 URL(')) {
        // 괄호 안의 URL 추출
        const match = msg.match(/\((https?:\/\/[^)]+)\)/)
        const urlHint = match ? match[1] : undefined
        const customMsg = urlHint ? `올바른 URL(${urlHint}으로 시작)을 입력해주세요.` : msg
        throw new CustomHttpException(ErrorCode.DAUM_INVALID_URL, { siteId, daumSiteUrl, errorMessage: customMsg })
      }
      throw new CustomHttpException(ErrorCode.DAUM_UNKNOWN_ERROR, { siteId, daumSiteUrl, errorMessage: msg })
    }
  }
}
