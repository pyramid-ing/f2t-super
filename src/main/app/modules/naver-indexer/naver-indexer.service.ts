import { Injectable, Logger } from '@nestjs/common'
import { SiteConfigService } from '@main/app/modules/site-config/site-config.service'
import { NaverAccountService } from '../naver-account/naver-account.service'
import { NaverAuthService } from '../naver-auth/naver-auth.service'
import { sleep } from '@main/app/utils/sleep'
import { Browser, chromium, Page } from 'patchright'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { SettingsService } from '@main/app/modules/settings/settings.service'

@Injectable()
export class NaverIndexerService {
  private readonly logger = new Logger(NaverIndexerService.name)

  constructor(
    private readonly siteConfigService: SiteConfigService,
    private readonly naverAccountService: NaverAccountService,
    private readonly naverAuthService: NaverAuthService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * 하나의 브라우저 세션으로 여러 URL을 연속 처리 (벌크)
   */
  public async submitUrls(
    siteId: number,
    urls: string[],
  ): Promise<{ success: boolean; message: string; results: any[] }> {
    const siteConfig = await this.siteConfigService.getSiteConfig(siteId)
    if (!siteConfig) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { siteId })
    }

    const naverConfig = await this._getNaverConfig(siteId)
    const naverId = naverConfig.naverId
    const naverPw = naverConfig.password
    const useHeadless = await this.settingsService.getPlaywrightHeadless()

    const browser: Browser = await chromium.launch({
      headless: useHeadless,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    })

    const page: Page = await browser.newPage()

    const results: { url: string; success: boolean; message: string }[] = []

    try {
      const loginSuccess = await this.naverAuthService.ensureLogin(page, naverId, naverPw)
      if (!loginSuccess) {
        throw new CustomHttpException(ErrorCode.NAVER_AUTH_FAIL, {
          siteId,
          naverId,
          errorMessage: '로그인에 실패했습니다.',
        })
      }

      await page.goto(`https://searchadvisor.naver.com/console/site/request/crawl?site=${siteConfig.siteUrl}`)
      await sleep(1500)

      // 사이트 등록 상태 확인 (내부에서 예외 처리)
      await this._checkSiteRegistration(page, siteConfig.siteUrl, siteId)

      for (const targetUrl of urls) {
        try {
          const inputSelector = 'input[type="text"][maxlength="2048"]'
          await page.waitForSelector(inputSelector, { timeout: 10000 })
          await page.evaluate(() => {
            const input = document.querySelector('#collectReqUrl') as HTMLInputElement
            if (input) input.value = ''
          })
          await page.fill(inputSelector, targetUrl)

          const buttons = await page.$$('button')
          for (const btn of buttons) {
            const text = await btn.textContent()
            if (text && text.trim() === '확인') {
              await btn.click()
              break
            }
          }

          let dialogAppeared = false
          let dialogMsg = ''
          const onDialog = async (dialog: any) => {
            dialogAppeared = true
            dialogMsg = dialog.message()
            await dialog.dismiss()
          }
          page.on('dialog', onDialog)

          await sleep(800)
          const timeoutMs = 15000
          const pollInterval = 400
          let isSuccess = false
          const start = Date.now()
          while (Date.now() - start < timeoutMs) {
            if (dialogAppeared) break
            isSuccess = await page.evaluate(url => {
              const firstRowLink = document.querySelector(
                '.v-data-table__wrapper tbody tr:first-child td:nth-child(2) a',
              )
              if (!firstRowLink) return false
              const inputUrl = new URL(url)
              return firstRowLink.textContent?.trim() === inputUrl.pathname || firstRowLink.getAttribute('href') === url
            }, targetUrl)
            if (isSuccess) break
            await sleep(pollInterval)
          }
          page.off('dialog', onDialog)

          if (dialogAppeared) {
            results.push({ url: targetUrl, success: false, message: dialogMsg || '이미 요청된 URL' })
          } else if (isSuccess) {
            results.push({ url: targetUrl, success: true, message: '색인 요청 성공' })
          } else {
            results.push({ url: targetUrl, success: false, message: '색인 반영 확인 실패' })
          }
        } catch (e: any) {
          results.push({ url: targetUrl, success: false, message: e?.message || '처리 중 오류' })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failedCount = results.length - successCount
      return {
        success: failedCount === 0,
        message: `네이버 벌크 처리 완료 (성공 ${successCount} / 실패 ${failedCount})`,
        results,
      }
    } finally {
      await browser.close()
    }
  }

  private async _getNaverConfig(siteId: number) {
    try {
      const siteConfig = await this.siteConfigService.getSiteConfig(siteId)
      if (!siteConfig) {
        throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { siteId, exists: false })
      }

      if (!siteConfig.naverConfig || !siteConfig.naverConfig.use) {
        throw new CustomHttpException(ErrorCode.NAVER_CONFIG_DISABLED, { siteId, naverConfigEnabled: false })
      }

      const naverAccountId = siteConfig.naverConfig.selectedNaverAccountId
      if (!naverAccountId) {
        throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_SELECTED, { siteId, hasSelectedAccount: false })
      }

      const account = await this.naverAccountService.getAccountById(naverAccountId)
      if (!account) {
        throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, {
          siteId,
          accountId: naverAccountId,
          exists: false,
        })
      }

      if (!account.isActive) {
        throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_INACTIVE, {
          siteId,
          accountId: naverAccountId,
          naverId: account.naverId,
          isActive: false,
        })
      }

      return {
        naverId: account.naverId,
        password: account.password,
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.NAVER_UNKNOWN_ERROR, { siteId, errorMessage: error.message })
    }
  }

  /**
   * 사이트 등록 상태 확인
   */
  private async _checkSiteRegistration(page: Page, siteUrl: string, siteId: number): Promise<void> {
    const currentUrl = page.url()

    // 네이버 로그인 필요 여부 (로그인 페이지로 리다이렉트 된 경우)
    if (currentUrl.includes('nid.naver.com/oauth2.0/authorize')) {
      throw new CustomHttpException(ErrorCode.NAVER_AUTH_FAIL, {
        siteId,
        siteUrl,
        errorMessage:
          '네이버 로그인이 만료되었거나 세션에 문제가 있습니다. 네이버에서 로그아웃 후 다시 로그인해 주세요.',
      })
    }

    // 접근권한 없음 에러 페이지 확인
    const errorMessage = await page.$('[class*="error_wrap"] p.mb-0')
    if (errorMessage) {
      const errorText = await errorMessage.textContent()
      if (errorText && errorText.includes('접근권한이 없습니다')) {
        throw new CustomHttpException(ErrorCode.NAVER_SITE_NOT_REGISTERED, {
          siteId,
          siteUrl,
          errorMessage: '해당 사이트가 네이버 서치어드바이저에 등록되지 않았습니다.',
        })
      }
    }

    // 정상적인 크롤링 요청 페이지 요소 확인
    const crawlForm = await page.$('input[type="text"][maxlength="2048"]')
    if (crawlForm) {
      return
    }

    // URL 구조 확인 (등록되지 않은 사이트는 다른 페이지로 리다이렉트될 수 있음)
    if (!currentUrl.includes('request/crawl') || currentUrl.includes('error')) {
      throw new CustomHttpException(ErrorCode.NAVER_SITE_NOT_REGISTERED, {
        siteId,
        siteUrl,
        errorMessage: '크롤링 요청 페이지에 접근할 수 없습니다.',
      })
    }

    // URL은 정상이나 폼이 없고 에러 페이지도 아닌 애매한 상태 → Unknown 에러
    throw new CustomHttpException(ErrorCode.NAVER_UNKNOWN_ERROR, {
      siteId,
      siteUrl,
      currentUrl,
      errorMessage: '사이트 등록 상태를 명확히 확인할 수 없습니다.',
    })
  }
}
