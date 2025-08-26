import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CreateNaverAccountDto } from './dto/create-naver-account.dto'
import { UpdateNaverAccountDto } from './dto/update-naver-account.dto'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { chromium, Browser, Page } from 'playwright'
import { sleep } from '@main/app/utils/sleep'
import * as path from 'path'
import * as fs from 'fs'

@Injectable()
export class NaverAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllAccounts() {
    return this.prisma.naverAccount.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async getActiveAccounts() {
    return this.prisma.naverAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getAccountById(id: number) {
    const account = await this.prisma.naverAccount.findUnique({
      where: { id },
    })

    if (!account) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { id })
    }

    return account
  }

  async getAccountByNaverId(naverId: string) {
    return this.prisma.naverAccount.findUnique({
      where: { naverId },
    })
  }

  async createAccount(data: CreateNaverAccountDto) {
    const existing = await this.getAccountByNaverId(data.naverId)
    if (existing) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_DUPLICATE, { naverId: data.naverId })
    }

    return this.prisma.naverAccount.create({
      data: {
        name: data.name,
        naverId: data.naverId,
        password: data.password,
        isActive: data.isActive ?? true,
      },
    })
  }

  async updateAccount(id: number, data: UpdateNaverAccountDto) {
    await this.getAccountById(id)
    if (data.naverId) {
      const existing = await this.getAccountByNaverId(data.naverId)
      if (existing && existing.id !== id) {
        throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_DUPLICATE, { naverId: data.naverId })
      }
    }

    return this.prisma.naverAccount.update({
      where: { id },
      data,
    })
  }

  async deleteAccount(id: number) {
    await this.getAccountById(id)

    await this.prisma.naverAccount.delete({
      where: { id },
    })

    return { success: true, message: '네이버 계정이 삭제되었습니다.' }
  }

  async updateLoginStatus(naverId: string, isLoggedIn: boolean, lastLogin?: Date) {
    const account = await this.getAccountByNaverId(naverId)
    if (!account) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { naverId })
    }

    return this.prisma.naverAccount.update({
      where: { naverId },
      data: {
        isLoggedIn,
        lastLogin: lastLogin || (isLoggedIn ? new Date() : account.lastLogin),
      },
    })
  }

  /**
   * 수동 로그인을 위한 브라우저 창을 열고 로그인 완료를 기다립니다
   */
  async startManualLogin(naverId: string): Promise<{ success: boolean; message: string }> {
    const account = await this.getAccountByNaverId(naverId)
    if (!account) {
      throw new CustomHttpException(ErrorCode.NAVER_ACCOUNT_NOT_FOUND, { naverId })
    }

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

      // 네이버 로그인 페이지로 이동
      await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded' })

      // 먼저 자동 로그인 시도
      const autoLoginSuccess = await this.performAutoLogin(page, account.naverId, account.password)

      if (autoLoginSuccess) {
        // 자동 로그인 성공 시 쿠키 저장 및 상태 업데이트
        await this.saveCookies(page, naverId)
        await this.updateLoginStatus(naverId, true, new Date())
        return { success: true, message: '네이버 자동 로그인이 완료되었습니다.' }
      }

      // 자동 로그인 실패 시 사용자가 수동으로 로그인할 때까지 대기
      // 네이버 메인 페이지로 리다이렉트되면 로그인 완료로 간주
      await page.waitForURL('https://www.naver.com', { timeout: 300000 }) // 5분 타임아웃

      // 로그인 성공 시 쿠키 저장
      await this.saveCookies(page, naverId)

      // 로그인 상태 업데이트
      await this.updateLoginStatus(naverId, true, new Date())

      return { success: true, message: '네이버 수동 로그인이 완료되었습니다.' }
    } catch (error) {
      console.error('수동 로그인 중 오류:', error)
      return { success: false, message: '로그인에 실패했습니다. 다시 시도해주세요.' }
    } finally {
      if (page) await page.close()
      if (browser) await browser.close()
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
      const hasCaptcha = await this.detectCaptcha(page)
      if (hasCaptcha) {
        console.log('캡챠가 감지되었습니다. 수동 로그인으로 전환합니다.')
        return false
      }

      // 새로운 기기 등록 페이지 처리
      const deviceRegistrationSuccess = await this.handleDeviceRegistration(page)
      if (!deviceRegistrationSuccess) {
        console.log('새로운 기기 등록 처리에 실패했습니다. 수동 로그인으로 전환합니다.')
        return false
      }

      // 로그인 성공 여부 확인
      try {
        await page.waitForURL('https://www.naver.com', { waitUntil: 'networkidle', timeout: 10000 })

        if (!page.url().includes('nid.naver.com')) {
          console.log('네이버 자동 로그인 성공')
          return true
        } else {
          console.log('네이버 자동 로그인 실패: 로그인 페이지에 머무름')
          return false
        }
      } catch (timeoutError) {
        console.log('자동 로그인 타임아웃. 수동 로그인으로 전환합니다.')
        return false
      }
    } catch (error) {
      console.error('네이버 자동 로그인 실패:', error)
      return false
    }
  }

  /**
   * 캡챠 감지
   */
  private async detectCaptcha(page: Page): Promise<boolean> {
    try {
      const captchaElement = await page.$('#captcha')
      return captchaElement !== null
    } catch {
      return false
    }
  }

  /**
   * 새로운 기기 등록 페이지 처리
   */
  private async handleDeviceRegistration(page: Page): Promise<boolean> {
    try {
      // 새로운 기기 등록 페이지인지 확인
      const isDeviceRegistrationPage = await page.evaluate(() => {
        return (
          document.title.includes('새로운 기기') ||
          document.body.textContent?.includes('새로운 기기') ||
          window.location.href.includes('device')
        )
      })

      if (isDeviceRegistrationPage) {
        // "다음에 하기" 버튼 클릭 시도
        const skipButton = await page.$(
          'button:has-text("다음에 하기"), button:has-text("나중에"), a:has-text("다음에 하기"), a:has-text("나중에")',
        )
        if (skipButton) {
          await skipButton.click()
          await sleep(2000)
          return true
        }

        // 확인 버튼 클릭 시도
        const confirmButton = await page.$('button:has-text("확인"), button:has-text("OK"), button[type="submit"]')
        if (confirmButton) {
          await confirmButton.click()
          await sleep(2000)
          return true
        }

        return false
      }

      return true
    } catch (error) {
      console.error('기기 등록 페이지 처리 중 오류:', error)
      return false
    }
  }

  /**
   * 쿠키를 파일로 저장합니다
   */
  private async saveCookies(page: Page, naverId: string): Promise<void> {
    const cookies = await page.context().cookies()
    const cookieDir = process.env.COOKIE_DIR || path.join(process.cwd(), 'static', 'cookies')

    if (!fs.existsSync(cookieDir)) {
      fs.mkdirSync(cookieDir, { recursive: true })
    }

    const naverIdForFile = naverId.replace(/[^\w\-]/g, '_')
    const cookiePath = path.join(cookieDir, `naver_${naverIdForFile}.json`)

    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2))
  }
}
