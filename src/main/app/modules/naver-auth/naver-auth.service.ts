import { Injectable, Inject, Logger } from '@nestjs/common'
import { Browser, Page } from 'patchright'
import { chromium } from 'patchright'
import * as path from 'path'
import * as fs from 'fs'
import { sleep } from '@main/app/utils/sleep'
import { EnvConfig } from '@main/config/env.config'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { NaverLoginStatus } from './naver-auth.types'

// 캡챠 해제를 위한 인터페이스
export interface CaptchaSolver {
  solveCaptcha(imageBase64: string): Promise<string>
}

@Injectable()
export class NaverAuthService {
  private readonly logger = new Logger(NaverAuthService.name)

  constructor(
    @Inject('CAPTCHA_SOLVER') private readonly captchaSolver: CaptchaSolver,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * 로그인 플로우 실행
   */
  public async ensureLogin(page: Page, naverId: string, password: string): Promise<boolean> {
    // 1. 쿠키 불러오기
    await this._loadCookie(page, naverId)

    // 2. 로그인 체크
    const loginStatus = await this._checkLoginStatus(page)

    // 3. 로그인이 안되어 있으면 로그인 시도
    if (loginStatus.needsLogin) {
      this.logger.log('로그인이 필요합니다. 로그인을 시도합니다...')
      const loginSuccess = await this._performLogin(page, naverId, password)
      if (!loginSuccess) {
        return false
      }
    } else {
      this.logger.log('이미 로그인되어 있습니다.')

      // 이미 로그인된 상태에서도 새로운 기기 등록 페이지가 나타날 수 있음
      await this._handleDeviceRegistration(page)
    }

    return true
  }

  /**
   * 수동 로그인을 위한 브라우저 창을 열고 로그인 완료를 기다립니다
   */
  public async startManualLogin(naverId: string, password: string): Promise<{ success: boolean; message: string }> {
    let browser: Browser | null = null
    let page: Page | null = null

    try {
      // 브라우저 시작 (headless: false로 설정하여 사용자가 볼 수 있게)
      browser = await chromium.launch({
        headless: false,
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

      page = await browser.newPage()

      // 뷰포트 설정
      await page.setViewportSize({ width: 1200, height: 800 })

      // 기존 쿠키 로드
      await this._loadCookie(page, naverId)

      // 네이버 로그인 페이지로 이동
      await page.goto('https://nid.naver.com/nidlogin.login?mode=form&url=https://www.naver.com', {
        waitUntil: 'domcontentloaded',
      })

      // 먼저 자동 로그인 시도
      const autoLoginSuccess = await this._performAutoLogin(page, naverId, password)

      if (autoLoginSuccess) {
        // 자동 로그인 성공 시 쿠키 저장 및 상태 업데이트
        await this._saveCookie(page, naverId)
        return { success: true, message: '네이버 자동 로그인이 완료되었습니다.' }
      }

      // 자동 로그인 실패 시 사용자가 수동으로 로그인할 때까지 대기합니다.
      // 네이버는 로그인 완료 후 쿼리스트링/경로를 붙여 리다이렉트할 수 있으므로
      // URL을 `https://www.naver.com`과 정확히 비교하면 정상 로그인도 타임아웃됩니다.
      await this._waitForManualLoginCompletion(page)

      // 실제 로그인 상태 확인 후 DB 업데이트
      const loginStatus = await this._checkLoginStatus(page)
      if (loginStatus.isLoggedIn) {
        // 로그인 성공 시 쿠키 저장
        await this._saveCookie(page, naverId)

        return { success: true, message: '네이버 수동 로그인이 완료되었습니다.' }
      } else {
        throw new Error('로그인 실패')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`네이버 수동 로그인 처리 실패: ${errorMessage}`)

      return {
        success: false,
        message: '네이버 로그인 완료를 확인하지 못했습니다. 로그인 후 네이버 메인 화면이 표시되는지 확인해 주세요.',
      }
    } finally {
      if (page) await page.close()
      if (browser) await browser.close()
    }
  }

  /**
   * 네이버 로그인 페이지의 리다이렉트 변형을 허용하면서 수동 로그인 완료를 기다립니다.
   */
  private async _waitForManualLoginCompletion(page: Page): Promise<void> {
    const timeout = 5 * 60 * 1000
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeout) {
      const currentUrl = page.url()

      // 로그인 완료 직후 기기 등록 화면이 나오는 경우가 있어 여기서 처리합니다.
      if (currentUrl.includes('nid.naver.com/login/ext/deviceConfirm')) {
        await this._handleDeviceRegistration(page)
      }

      // 네이버 로그인 호스트를 벗어났다면 로그인 완료 여부를 실제로 확인합니다.
      if (!page.url().includes('nid.naver.com')) {
        return
      }

      await page.waitForTimeout(500)
    }

    throw new Error('수동 로그인 확인 시간이 초과되었습니다.')
  }

  /**
   * 실제 로그인 상태를 확인하고 DB를 업데이트합니다
   */
  public async checkAndUpdateLoginStatus(naverId: string): Promise<{ isLoggedIn: boolean; message: string }> {
    let browser: Browser | null = null
    let page: Page | null = null

    try {
      // 브라우저 시작 (설정에 따라 headless 여부 결정)
      const headless = await this.settingsService.getPlaywrightHeadless()
      browser = await chromium.launch({
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

      page = await browser.newPage()

      // 뷰포트 설정
      await page.setViewportSize({ width: 1200, height: 800 })

      // 기존 쿠키 로드
      await this._loadCookie(page, naverId)

      // 실제 로그인 상태 확인
      const loginStatus = await this._checkLoginStatus(page)

      return {
        isLoggedIn: loginStatus.isLoggedIn,
        message: loginStatus.message,
      }
    } finally {
      if (page) await page.close()
      if (browser) await browser.close()
    }
  }

  /**
   * 쿠키를 삭제하는 함수
   */
  public deleteCookie(naverId: string): { success: boolean; message: string } {
    const cookiePath = this._getCookiePath(naverId)
    if (fs.existsSync(cookiePath)) {
      fs.unlinkSync(cookiePath)
      this.logger.log(`네이버 쿠키 삭제 완료: ${naverId}`)
      return { success: true, message: '쿠키가 삭제되었습니다.' }
    } else {
      this.logger.warn(`네이버 쿠키 파일이 존재하지 않습니다: ${naverId}`)
      return { success: true, message: '삭제할 쿠키 파일이 없습니다.' }
    }
  }

  /**
   * 쿠키 파일 경로를 가져오는 함수
   */
  private _getCookiePath(naverId: string): string {
    const cookieDir = path.join(EnvConfig.userDataCustomPath, 'cookies')
    if (!fs.existsSync(cookieDir)) fs.mkdirSync(cookieDir, { recursive: true })
    const naverIdForFile = naverId.replace(/[^a-zA-Z0-9_\-]/g, '_')
    return path.join(cookieDir, `naver_${naverIdForFile}.json`)
  }

  /**
   * 쿠키를 로드하는 함수
   */
  private async _loadCookie(page: Page, naverId: string): Promise<boolean> {
    const cookiePath = this._getCookiePath(naverId)

    if (fs.existsSync(cookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'))
      await page.context().addCookies(cookies)
      this.logger.log('네이버 쿠키 적용 완료')
      return true
    } else {
      this.logger.error('네이버 쿠키 파일이 존재하지 않습니다. 비로그인 상태로 진행합니다.')
      return false
    }
  }

  /**
   * 쿠키를 저장하는 함수
   */
  private async _saveCookie(page: Page, naverId: string = 'default'): Promise<void> {
    const cookiePath = this._getCookiePath(naverId)
    const cookies = await page.context().cookies()
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf-8')
    this.logger.log('네이버 로그인 후 쿠키 저장 완료')
  }

  /**
   * 로그인 상태 확인
   */
  private async _checkLoginStatus(page: Page): Promise<NaverLoginStatus> {
    // 네이버 메인 페이지로 이동하여 로그인 상태 확인
    // 일부 환경에서 광고/실시간 연결로 인해 networkidle 상태에 도달하지 않는 경우가 있어
    // 우선 domcontentloaded로 이동을 보장하고, networkidle은 짧게 보조 대기합니다.
    await page.goto('https://www.naver.com', { waitUntil: 'domcontentloaded', timeout: 45000 })

    await Promise.race([
      page.waitForLoadState('networkidle'),
      page.waitForTimeout(5000), // 5초 넘으면 그냥 진행
    ])

    // 네이버 메인 화면의 CSS 클래스는 자주 변경되므로, 로그인 세션 쿠키를
    // 우선 확인합니다. 쿠키가 있는데 화면 선택자를 찾지 못해 로그아웃으로
    // 판정하는 경우를 방지합니다.
    const cookies = await page.context().cookies(['https://www.naver.com'])
    const hasNaverSession = cookies.some(
      cookie => ['NID_AUT', 'NID_SES'].includes(cookie.name) && cookie.value.length > 0,
    )

    if (hasNaverSession) {
      return {
        isLoggedIn: true,
        needsLogin: false,
        message: '네이버 로그인 세션이 확인되었습니다.',
      }
    }

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
    const userInfo = await page.$('[class*="info_user"]')
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

    return {
      isLoggedIn: false,
      needsLogin: true,
      message: '로그인 상태를 알 수 없습니다.',
    }
  }

  /**
   * 캡챠 감지
   */
  private async _detectCaptcha(page: Page): Promise<boolean> {
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
  private async _solveCaptcha(page: Page): Promise<boolean> {
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
          await this._clickNaverLoginButton(page)
          await sleep(2000)
          return true
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
      await this._clickNaverLoginButton(page)
      await sleep(2000)
      return true
    }

    return false
  }

  /**
   * 새로운 기기 등록 페이지 처리
   */
  private async _handleDeviceRegistration(page: Page): Promise<boolean> {
    // 새로운 기기 등록 페이지인지 확인
    const isDeviceConfirmPage = page.url().includes('nid.naver.com/login/ext/deviceConfirm')
    if (!isDeviceConfirmPage) {
      return true // 새로운 기기 등록 페이지가 아님
    }

    this.logger.log('새로운 기기 등록 페이지가 감지되었습니다. 자동으로 등록을 진행합니다.')

    // 여러 방법으로 등록 버튼 찾기
    let registerButton = await page.$('#new\\.save')

    // 첫 번째 방법이 실패하면 다른 선택자 시도
    if (!registerButton) {
      registerButton = await page.$('a[href="#"]:has-text("등록")')
    }

    // 두 번째 방법도 실패하면 텍스트로 찾기
    if (!registerButton) {
      const buttons = await page.$$('a.btn')
      for (const btn of buttons) {
        const text = await btn.textContent()
        if (text && text.trim() === '등록') {
          registerButton = btn
          break
        }
      }
    }

    if (registerButton) {
      await registerButton.click()
      this.logger.log('새로운 기기 등록 버튼을 클릭했습니다.')

      // 등록 처리 완료 대기
      await sleep(3000)

      // 네이버 메인 페이지로 리다이렉트 확인 (여러 방법 시도)
      // 일부 환경에서 광고/실시간 연결로 인해 networkidle 상태에 도달하지 않는 경우가 있어
      // 우선 domcontentloaded로 이동을 보장하고, networkidle은 짧게 보조 대기합니다.
      await page.waitForURL(
        url => {
          const currentUrl = url.toString()
          return currentUrl.includes('www.naver.com') || currentUrl.includes('searchadvisor.naver.com')
        },
        {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        },
      )

      await Promise.race([
        page.waitForLoadState('networkidle'),
        page.waitForTimeout(5000), // 5초 넘으면 그냥 진행
      ])

      const currentUrl = page.url()
      if (currentUrl.includes('www.naver.com') || currentUrl.includes('searchadvisor.naver.com')) {
        this.logger.log('새로운 기기 등록이 완료되었습니다.')
        return true
      } else {
        this.logger.warn(`새로운 기기 등록 후 예상 페이지로 이동하지 못했습니다. 현재 URL: ${currentUrl}`)
        return false
      }
    } else {
      this.logger.warn('새로운 기기 등록 버튼을 찾을 수 없습니다.')
      return false
    }
  }

  /**
   * 로그인 수행
   */
  private async _performLogin(page: Page, naverId: string, password: string): Promise<boolean> {
    await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded' })

    // ID 입력
    await page.waitForSelector('#id', { timeout: 10000 })
    await page.fill('#id', naverId)

    // 비밀번호 입력
    await page.waitForSelector('#pw', { timeout: 10000 })
    await page.fill('#pw', password)

    // 로그인 버튼 클릭
    await this._clickNaverLoginButton(page)
    await sleep(2000)

    // 캡챠가 나타났는지 확인
    const hasCaptcha = await this._detectCaptcha(page)
    if (hasCaptcha) {
      this.logger.log('캡챠가 감지되었습니다. 캡챠 해제를 시도합니다.')
      const captchaSolved = await this._solveCaptcha(page)
      if (!captchaSolved) {
        this.logger.error('캡챠 해제에 실패했습니다.')
        return false
      }
    }

    // 새로운 기기 등록 페이지 처리
    const deviceRegistrationSuccess = await this._handleDeviceRegistration(page)
    if (!deviceRegistrationSuccess) {
      this.logger.warn('새로운 기기 등록 처리에 실패했습니다.')
      return false
    }

    // 로그인 성공 여부 확인
    const loginStatus = await this._checkLoginStatus(page)

    if (loginStatus.isLoggedIn) {
      await this._saveCookie(page, naverId)
      this.logger.log('네이버 로그인 성공 및 쿠키 저장 완료')
      return true
    } else {
      this.logger.warn('네이버 로그인 실패: 로그인 페이지에 머무름')
      return false
    }
  }

  /**
   * 자동 로그인을 수행합니다
   */
  private async _performAutoLogin(page: Page, naverId: string, password: string): Promise<boolean> {
    // ID 입력
    await page.waitForSelector('#id', { timeout: 10000 })
    await page.fill('#id', naverId)

    // 비밀번호 입력
    await page.waitForSelector('#pw', { timeout: 10000 })
    await page.fill('#pw', password)

    // 로그인 버튼 클릭
    await this._clickNaverLoginButton(page)
    await sleep(2000)

    // 캡챠가 나타났는지 확인
    const hasCaptcha = await this._detectCaptcha(page)
    if (hasCaptcha) {
      this.logger.log('캡챠가 감지되었습니다. 수동 로그인으로 전환합니다.')
      return false
    }

    // 새로운 기기 등록 페이지 처리
    const deviceRegistrationSuccess = await this._handleDeviceRegistration(page)
    if (!deviceRegistrationSuccess) {
      this.logger.log('새로운 기기 등록 처리에 실패했습니다. 수동 로그인으로 전환합니다.')
      return false
    }

    // 로그인 성공 여부 확인
    // 일부 환경에서 광고/실시간 연결로 인해 networkidle 상태에 도달하지 않는 경우가 있어
    // 우선 domcontentloaded로 이동을 보장하고, networkidle은 짧게 보조 대기합니다.
    try {
      // 로그인 성공 후 네이버가 쿼리스트링이나 추가 경로를 붙일 수 있습니다.
      await page.waitForURL(url => !url.toString().includes('nid.naver.com'), {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      })

      await Promise.race([
        page.waitForLoadState('networkidle'),
        page.waitForTimeout(5000), // 5초 넘으면 그냥 진행
      ])

      if (!page.url().includes('nid.naver.com')) {
        this.logger.log('네이버 자동 로그인 성공')
        return true
      } else {
        this.logger.log('네이버 자동 로그인 실패: 로그인 페이지에 머무름')
        return false
      }
    } catch (timeoutError) {
      this.logger.log('자동 로그인 타임아웃. 수동 로그인으로 전환합니다.')
      return false
    }
  }

  /**
   * 네이버 로그인 페이지에는 검색용 submit 버튼도 함께 존재할 수 있으므로
   * `button[type="submit"]`만 사용하면 검색 버튼을 잘못 클릭할 수 있습니다.
   */
  private async _clickNaverLoginButton(page: Page): Promise<void> {
    const selectors = [
      'button[id^="loginBtn_"]:visible',
      'button.btn_login',
      'button[id="log.login"]',
      'button[type="submit"][class*="login"]',
      'input[type="submit"][class*="login"]',
    ]

    for (const selector of selectors) {
      const button = page.locator(selector).first()
      if ((await button.count()) > 0) {
        await button.scrollIntoViewIfNeeded()
        await button.click({ force: true })
        return
      }
    }

    // 네이버 로그인 UI가 아직 CSS 초기화 중인 경우에도 실제 DOM 버튼을
    // 확인해 클릭합니다. 버튼 ID는 네이버의 현재 로그인 DOM에서 안정적으로
    // 유지되는 식별자입니다.
    const clickedByDom = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[id^="loginBtn_"]'))
      const button = buttons.find(element => {
        const style = window.getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }) as HTMLButtonElement | undefined

      if (!button) return false
      button.click()
      return true
    })

    if (clickedByDom) return

    throw new Error('네이버 로그인 버튼을 찾을 수 없습니다.')
  }
}
