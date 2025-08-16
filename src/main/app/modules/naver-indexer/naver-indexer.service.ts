import fs from 'node:fs'
import path from 'node:path'
import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common'
import { SiteConfigService } from '@main/app/modules/site-config/site-config.service'
import { NaverAccountService } from '../naver-account/naver-account.service'
import { sleep } from '@main/app/utils/sleep'
import { Browser, chromium, Page } from 'playwright'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

export interface NaverIndexerOptions {
  siteId: number
  urlsToIndex: string[]
  naverId?: string // 네이버 아이디 - NaverAccount에서 정보를 가져옴
  naverPw?: string // 네이버 비번 - NaverAccount에서 정보를 가져옴 (선택)
}

export interface NaverLoginStatus {
  isLoggedIn: boolean
  needsLogin: boolean
  message: string
}

// 캡챠 해제를 위한 인터페이스
export interface CaptchaSolver {
  solveCaptcha(imageBase64: string): Promise<string>
}

// 기본 캡챠 해제 서비스 (AI 서비스 연동 전까지 사용)
@Injectable()
export class DefaultCaptchaSolver implements CaptchaSolver {
  async solveCaptcha(imageBase64: string): Promise<string> {
    // TODO: AI 서비스 연동
    // 현재는 수동 입력을 기다리는 방식
    throw new Error('AI 서비스 연동이 필요합니다. 수동으로 캡챠를 해제해주세요.')
  }
}

// 쿠키 저장 경로 분기 (tistory-bot 방식과 동일)
function getNaverCookiePath(naverId?: string) {
  const isProd = process.env.NODE_ENV === 'production'
  const cookieDir = process.env.COOKIE_DIR
  if (!require('node:fs').existsSync(cookieDir)) require('node:fs').mkdirSync(cookieDir, { recursive: true })
  const naverIdForFile = (naverId || 'default').replace(/[^\w\-]/g, '_')
  return path.join(cookieDir, `naver_${naverIdForFile}.json`)
}

@Injectable()
export class NaverIndexerService implements OnModuleInit {
  private readonly logger = new Logger(NaverIndexerService.name)

  constructor(
    private readonly siteConfigService: SiteConfigService,
    private readonly naverAccountService: NaverAccountService,
    @Inject('CAPTCHA_SOLVER') private readonly captchaSolver: CaptchaSolver,
  ) {}

  async onModuleInit() {}

  private async getNaverConfig(siteId: number) {
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
        headless: siteConfig.naverConfig.headless ?? true,
      }
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.NAVER_UNKNOWN_ERROR, { siteId, errorMessage: error.message })
    }
  }

  /**
   * Playwright용 쿠키 복원
   */
  private async loadCookies(page: Page, naverId?: string): Promise<boolean> {
    const cookiePath = getNaverCookiePath(naverId)
    if (fs.existsSync(cookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'))
      await page.context().addCookies(cookies)
      this.logger.log('쿠키를 불러와 세션을 복원합니다.')
      return true
    } else {
      this.logger.warn('쿠키 파일이 존재하지 않습니다. 먼저 수동으로 로그인 후 쿠키를 저장해 주세요.')
      return false
    }
  }

  /**
   * Playwright용 쿠키 저장
   */
  private async saveCookies(page: Page, naverId?: string) {
    const cookiePath = getNaverCookiePath(naverId)
    const cookies = await page.context().cookies()
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf-8')
    this.logger.log('쿠키를 저장했습니다.')
  }

  /**
   * 로그인 상태 확인
   */
  private async checkLoginStatus(page: Page): Promise<NaverLoginStatus> {
    try {
      // 네이버 메인 페이지로 이동하여 로그인 상태 확인
      await page.goto('https://www.naver.com', { waitUntil: 'domcontentloaded' })

      // 로그인 버튼이 있는지 확인 (로그인 안된 상태)
      // CSS 모듈 클래스명이 바뀔 수 있으므로 부분 선택자 사용
      const loginButton = await page.$('[class*="link_login"]')
      if (loginButton) {
        return {
          isLoggedIn: false,
          needsLogin: true,
          message: '로그인이 필요합니다.',
        }
      }

      // 사용자 정보가 표시되는지 확인 (로그인된 상태)
      // 로그인된 상태에서는 사용자 정보 영역이 나타남
      const userInfo = await page.$('.sc_login, [data-testid="user-info"], .user_info')
      if (userInfo) {
        return {
          isLoggedIn: true,
          needsLogin: false,
          message: '이미 로그인되어 있습니다.',
        }
      }

      // URL이 로그인 페이지로 리다이렉트되었는지 확인
      if (page.url().includes('nid.naver.com')) {
        return {
          isLoggedIn: false,
          needsLogin: true,
          message: '로그인 페이지로 리다이렉트되었습니다.',
        }
      }

      // 추가적인 로그인 상태 확인
      // 로그인된 상태에서는 특정 요소들이 나타나지 않음
      const loginText = await page.$('[class*="login_text"]')
      if (loginText) {
        return {
          isLoggedIn: false,
          needsLogin: true,
          message: '로그인 텍스트가 감지되어 로그인이 필요합니다.',
        }
      }

      return {
        isLoggedIn: true,
        needsLogin: false,
        message: '로그인 상태를 확인할 수 없지만 계속 진행합니다.',
      }
    } catch (error) {
      this.logger.error('로그인 상태 확인 중 오류:', error)
      return {
        isLoggedIn: false,
        needsLogin: true,
        message: '로그인 상태 확인 중 오류가 발생했습니다.',
      }
    }
  }

  /**
   * 캡챠 감지
   */
  private async detectCaptcha(page: Page): Promise<boolean> {
    try {
      const captchaWrap = await page.$('#captchaimg')
      return !!captchaWrap
    } catch (error) {
      this.logger.error('캡챠 감지 중 오류:', error)
      return false
    }
  }

  /**
   * 캡챠 해제 (AI 서비스 연동)
   */
  private async solveCaptcha(page: Page): Promise<boolean> {
    try {
      // 캡챠 이미지 요소 찾기
      const captchaImg = await page.$('#captchaimg')
      if (!captchaImg) {
        this.logger.error('캡챠 이미지를 찾을 수 없습니다.')
        return false
      }

      // 이미지 src 속성에서 base64 데이터 추출
      const imageSrc = await captchaImg.getAttribute('src')
      if (!imageSrc || !imageSrc.startsWith('data:image')) {
        this.logger.error('캡챠 이미지 데이터를 찾을 수 없습니다.')
        return false
      }

      // base64 데이터에서 실제 이미지 데이터 추출
      const base64Data = imageSrc.split(',')[1]
      if (!base64Data) {
        this.logger.error('캡챠 이미지 base64 데이터를 추출할 수 없습니다.')
        return false
      }

      try {
        // AI 서비스를 이용한 캡챠 해제
        const solution = await this.captchaSolver.solveCaptcha(base64Data)

        if (solution && solution.trim().length > 0) {
          // 캡챠 입력 필드에 해답 입력
          const captchaInput = await page.$('#captcha')
          if (captchaInput) {
            await captchaInput.fill(solution.trim())
            this.logger.log(`캡챠 해제 완료: ${solution}`)

            // 로그인 버튼 클릭
            const submitButton = await page.$('button[type="submit"]')
            if (submitButton) {
              await submitButton.click()
              await sleep(2000)
              return true
            }
          }
        } else {
          this.logger.error('AI 서비스가 빈 해답을 반환했습니다.')
          throw new CustomHttpException(ErrorCode.NAVER_CAPTCHA_SOLVE_FAILED, {
            errorMessage: 'AI 서비스가 빈 해답을 반환했습니다.',
          })
        }
      } catch (aiError) {
        this.logger.warn('AI 서비스 연동 실패, 수동 입력으로 대체:', aiError.message)

        if (aiError instanceof CustomHttpException) {
          throw aiError
        }

        // AI 서비스 실패 시 수동 입력 대기
        this.logger.warn('수동으로 캡챠를 해제해주세요.')

        // 사용자가 캡챠를 입력할 때까지 대기 (최대 60초)
        const maxWaitTime = 60000
        const pollInterval = 1000
        const startTime = Date.now()

        while (Date.now() - startTime < maxWaitTime) {
          const captchaInput = await page.$('#captcha')
          if (captchaInput) {
            const value = await captchaInput.inputValue()
            if (value && value.trim().length > 0) {
              this.logger.log('캡챠 입력이 감지되었습니다.')
              break
            }
          }
          await sleep(pollInterval)
        }

        // 로그인 버튼 클릭
        const submitButton = await page.$('button[type="submit"]')
        if (submitButton) {
          await submitButton.click()
          await sleep(2000)
          return true
        }
      }

      return false
    } catch (error) {
      this.logger.error('캡챠 해제 중 오류:', error)
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.NAVER_CAPTCHA_SOLVE_FAILED, {
        errorMessage: error.message,
      })
    }
  }

  /**
   * 로그인 수행
   */
  private async performLogin(page: Page, naverId: string, password: string): Promise<boolean> {
    try {
      await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded' })

      // ID 입력
      await page.waitForSelector('#id', { timeout: 10000 })
      await page.fill('#id', naverId)

      // 비밀번호 입력
      await page.waitForSelector('#pw', { timeout: 10000 })
      await page.fill('#pw', password)

      // 로그인 버튼 클릭
      await page.click('button[type="submit"]')
      await sleep(2000)

      // 캡챠가 나타났는지 확인
      const hasCaptcha = await this.detectCaptcha(page)
      if (hasCaptcha) {
        this.logger.log('캡챠가 감지되었습니다. 캡챠 해제를 시도합니다.')
        const captchaSolved = await this.solveCaptcha(page)
        if (!captchaSolved) {
          this.logger.error('캡챠 해제에 실패했습니다.')
          return false
        }
      }

      // 로그인 성공 여부 확인
      await page.waitForURL('https://www.naver.com', { waitUntil: 'networkidle', timeout: 10000 })

      if (!page.url().includes('nid.naver.com')) {
        await this.saveCookies(page, naverId)
        this.logger.log('네이버 로그인 성공 및 쿠키 저장 완료')
        return true
      } else {
        this.logger.warn('네이버 로그인 실패: 로그인 페이지에 머무름')
        return false
      }
    } catch (error) {
      this.logger.error('네이버 로그인 자동화 실패:', error)
      return false
    }
  }

  /**
   * 로그인 플로우 실행
   */
  private async ensureLogin(page: Page, naverId: string, password: string): Promise<boolean> {
    // 1. 쿠키 불러오기
    const hasCookie = await this.loadCookies(page, naverId)

    // 2. 로그인 체크
    const loginStatus = await this.checkLoginStatus(page)

    // 3. 로그인이 안되어 있으면 로그인 시도
    if (loginStatus.needsLogin) {
      this.logger.log('로그인이 필요합니다. 로그인을 시도합니다...')
      const loginSuccess = await this.performLogin(page, naverId, password)
      if (!loginSuccess) {
        return false
      }
    } else {
      this.logger.log('이미 로그인되어 있습니다.')
    }

    return true
  }

  async submitUrl(siteId: number, url: string): Promise<{ success: boolean; message: string }> {
    const siteConfig = await this.siteConfigService.getSiteConfig(siteId)
    if (!siteConfig) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { siteId })
    }

    const dbConfig = await this.getNaverConfig(siteId)
    const naverId = dbConfig.naverId
    const naverPw = dbConfig.password
    const useHeadless = false

    const browser: Browser = await chromium.launch({
      headless: useHeadless,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    })

    const page: Page = await browser.newPage()

    try {
      // 로그인 플로우 실행
      const loginSuccess = await this.ensureLogin(page, naverId, naverPw)
      if (!loginSuccess) {
        throw new CustomHttpException(ErrorCode.NAVER_AUTH_FAIL, {
          siteId,
          naverId,
          errorMessage: '로그인에 실패했습니다.',
        })
      }

      // 4. 인덱싱등록 페이지 이동
      await page.goto(`https://searchadvisor.naver.com/console/site/request/crawl?site=${siteConfig.siteUrl}`)
      await sleep(2000)

      // 인덱싱 입력창에 url 입력 및 확인 버튼 클릭
      const inputSelector = 'input[type="text"][maxlength="2048"]'
      await page.waitForSelector(inputSelector, { timeout: 10000 })
      await page.fill(inputSelector, url)

      // 확인 버튼 클릭
      const buttons = await page.$$('button')
      for (const btn of buttons) {
        const text = await btn.textContent()
        if (text && text.trim() === '확인') {
          await btn.click()
          break
        }
      }

      // 결과 대기 및 확인
      let dialogAppeared = false
      let dialogMsg = ''
      page.on('dialog', async dialog => {
        dialogAppeared = true
        dialogMsg = dialog.message()
        await dialog.dismiss()
      })

      await sleep(1000)
      const timeoutMs = 20000
      const pollInterval = 500
      let isSuccess = false
      const start = Date.now()

      while (Date.now() - start < timeoutMs) {
        if (dialogAppeared) break
        isSuccess = await page.evaluate(url => {
          const firstRowLink = document.querySelector('.v-data-table__wrapper tbody tr:first-child td:nth-child(2) a')
          if (!firstRowLink) return false
          const inputUrl = new URL(url)
          return firstRowLink.textContent?.trim() === inputUrl.pathname || firstRowLink.getAttribute('href') === url
        }, url)
        if (isSuccess) break
        await sleep(pollInterval)
      }

      if (dialogAppeared) {
        return { success: false, message: dialogMsg || '이미 요청된 URL' }
      }
      if (isSuccess) {
        return { success: true, message: '색인 요청 성공' }
      } else {
        return { success: false, message: '색인 요청 실패 또는 테이블에 20초 내 반영되지 않음' }
      }
    } finally {
      await browser.close()
    }
  }

  // TODO: 전역 설정 기반 indexUrls는 deprecated됨 - 사이트별 설정으로 대체
  // async indexUrls(urls: string[]): Promise<any> {
  //   // 이 함수는 전역 설정을 사용하는 레거시 함수입니다.
  //   // 새로운 구조에서는 manualIndexing을 siteId와 함께 사용하세요.
  //   throw new NaverAuthError('indexUrls는 deprecated됨. manualIndexing을 사용하세요.', 'indexUrls')
  // }
}
