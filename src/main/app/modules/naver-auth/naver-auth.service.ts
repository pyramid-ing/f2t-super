import { Injectable, Inject, Logger } from '@nestjs/common'
import { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import { sleep } from '@main/app/utils/sleep'
import { EnvConfig } from '@main/config/env.config'
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

  constructor(@Inject('CAPTCHA_SOLVER') private readonly captchaSolver: CaptchaSolver) {}

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
      const deviceRegistrationSuccess = await this._handleDeviceRegistration(page)
      if (!deviceRegistrationSuccess) {
        this.logger.warn('새로운 기기 등록 처리에 실패했습니다.')
        return false
      }
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
      const autoLoginSuccess = await this.performAutoLogin(page, naverId, password)

      if (autoLoginSuccess) {
        // 자동 로그인 성공 시 쿠키 저장 및 상태 업데이트
        await this._saveCookie(page, naverId)
        return { success: true, message: '네이버 자동 로그인이 완료되었습니다.' }
      }

      // 자동 로그인 실패 시 사용자가 수동으로 로그인할 때까지 대기
      // 네이버 메인 페이지로 리다이렉트되면 로그인 완료로 간주
      await page.waitForURL('https://www.naver.com', { timeout: 5 * 60 * 1000 }) // 5분 타임아웃

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
      this.logger.error('수동 로그인 중 오류:', error)
      return { success: false, message: '로그인에 실패했습니다. 다시 시도해주세요.' }
    } finally {
      if (page) await page.close()
      if (browser) await browser.close()
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
    try {
      const cookiePath = this._getCookiePath(naverId)
      if (fs.existsSync(cookiePath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'))
        await page.context().addCookies(cookies)
        this.logger.log('네이버 쿠키 적용 완료')
        return true
      } else {
        this.logger.warn('네이버 쿠키 파일이 존재하지 않습니다. 비로그인 상태로 진행합니다.')
        return false
      }
    } catch (error) {
      this.logger.error('네이버 쿠키 로드 중 오류:', error)
      return false
    }
  }

  /**
   * 쿠키를 저장하는 함수
   */
  private async _saveCookie(page: Page, naverId: string = 'default'): Promise<void> {
    try {
      const cookiePath = this._getCookiePath(naverId)
      const cookies = await page.context().cookies()
      fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf-8')
      this.logger.log('네이버 로그인 후 쿠키 저장 완료')
    } catch (error) {
      this.logger.error('네이버 쿠키 저장 중 오류:', error)
    }
  }

  /**
   * 쿠키를 삭제하는 함수
   */
  public deleteCookie(naverId: string): { success: boolean; message: string } {
    try {
      const cookiePath = this._getCookiePath(naverId)
      if (fs.existsSync(cookiePath)) {
        fs.unlinkSync(cookiePath)
        this.logger.log(`네이버 쿠키 삭제 완료: ${naverId}`)
        return { success: true, message: '쿠키가 삭제되었습니다.' }
      } else {
        this.logger.warn(`네이버 쿠키 파일이 존재하지 않습니다: ${naverId}`)
        return { success: true, message: '삭제할 쿠키 파일이 없습니다.' }
      }
    } catch (error) {
      this.logger.error('네이버 쿠키 삭제 중 오류:', error)
      return { success: false, message: '쿠키 삭제 중 오류가 발생했습니다.' }
    }
  }

  /**
   * 로그인 상태 확인
   */
  private async _checkLoginStatus(page: Page): Promise<NaverLoginStatus> {
    try {
      // 네이버 메인 페이지로 이동하여 로그인 상태 확인
      await page.goto('https://www.naver.com', { waitUntil: 'networkidle' })

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
   * 새로운 기기 등록 페이지 처리
   */
  private async _handleDeviceRegistration(page: Page): Promise<boolean> {
    try {
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
        try {
          await page.waitForURL('https://www.naver.com', { waitUntil: 'networkidle', timeout: 15000 })
        } catch (timeoutError) {
          // 타임아웃 발생 시 현재 URL 확인
          this.logger.warn('네이버 메인 페이지 대기 중 타임아웃, 현재 URL 확인 중...')
        }

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
    } catch (error) {
      this.logger.error('새로운 기기 등록 처리 중 오류:', error)
      return false
    }
  }

  /**
   * 로그인 수행
   */
  private async _performLogin(page: Page, naverId: string, password: string): Promise<boolean> {
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
    } catch (error) {
      this.logger.error('네이버 로그인 자동화 실패:', error)
      return false
    }
  }

  /**
   * 자동 로그인을 수행합니다
   */
  private async performAutoLogin(page: Page, naverId: string, password: string): Promise<boolean> {
    try {
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
      try {
        await page.waitForURL('https://www.naver.com', { waitUntil: 'networkidle', timeout: 10000 })

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
    } catch (error) {
      this.logger.error('네이버 자동 로그인 실패:', error)
      return false
    }
  }

  /**
   * 실제 로그인 상태를 확인하고 DB를 업데이트합니다
   */
  async checkAndUpdateLoginStatus(naverId: string): Promise<{ isLoggedIn: boolean; message: string }> {
    let browser: Browser | null = null
    let page: Page | null = null

    try {
      // 브라우저 시작 (headless: true로 설정하여 백그라운드에서 실행)
      browser = await chromium.launch({
        headless: true,
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
    } catch (error) {
      this.logger.error('로그인 상태 확인 중 오류:', error)
      return {
        isLoggedIn: false,
        message: '로그인 상태 확인 중 오류가 발생했습니다.',
      }
    } finally {
      if (page) await page.close()
      if (browser) await browser.close()
    }
  }
}
