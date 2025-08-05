import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, Page, LaunchOptions } from 'playwright'
import fs from 'fs'
import path from 'path'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { TistoryPostOptions } from '@main/app/modules/tistory/tistory.types'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { retry } from '@main/app/utils/retry'
import { EnvConfig } from '@main/config/env.config'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

@Injectable()
export class TistoryAutomationService {
  private readonly logger = new Logger(TistoryAutomationService.name)
  private browser: Browser | null = null

  constructor(private readonly geminiService: GeminiService) {}

  /**
   * 쿠키 파일 경로를 가져오는 함수
   */
  private getCookiePath(kakaoId: string = 'default'): string {
    const isProd = process.env.NODE_ENV === 'production'
    const cookieDir = isProd ? process.env.COOKIE_DIR : path.join(process.cwd(), 'static', 'cookies')
    if (!fs.existsSync(cookieDir)) fs.mkdirSync(cookieDir, { recursive: true })
    const kakaoIdForFile = kakaoId.replace(/[^a-zA-Z0-9_\-]/g, '_')
    return path.join(cookieDir, `tistory_${kakaoIdForFile}.json`)
  }

  /**
   * 쿠키를 로드하는 함수
   */
  private async loadCookie(browser: Browser, kakaoId: string): Promise<boolean> {
    try {
      const cookiePath = this.getCookiePath(kakaoId)
      if (fs.existsSync(cookiePath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'))
        const context = browser.contexts()[0]
        assert(context, '브라우저 컨텍스트를 찾을 수 없습니다')
        await context.addCookies(cookies)
        this.logger.log('쿠키 적용 완료')
        return true
      } else {
        this.logger.warn('쿠키 파일이 존재하지 않습니다. 비로그인 상태로 진행합니다.')
        return false
      }
    } catch (error) {
      this.logger.error('쿠키 로드 중 오류:', error)
      return false
    }
  }

  /**
   * 쿠키를 저장하는 함수
   */
  private async saveCookie(page: Page, kakaoId: string = 'default'): Promise<void> {
    try {
      const cookiePath = this.getCookiePath(kakaoId)
      const cookies = await page.context().cookies()
      fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf-8')
      this.logger.log('로그인 후 쿠키 저장 완료')
    } catch (error) {
      this.logger.error('쿠키 저장 중 오류:', error)
    }
  }

  /**
   * HTML 모드로 전환하는 함수
   */
  private async switchToHtmlMode(page: Page): Promise<void> {
    try {
      // 1. HTML 모드 드롭다운 열기 및 HTML 모드 클릭
      await page.waitForSelector('#editor-mode-layer-btn-open', { timeout: 10000 })
      await page.click('#editor-mode-layer-btn-open')
      this.logger.log('에디터 모드 드롭다운 오픈')
      await page.waitForSelector('#editor-mode-html', { timeout: 10000 })
      await page.click('#editor-mode-html')
      this.logger.log('HTML 모드 클릭')
    } catch (e) {
      throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
        message: `HTML 모드 전환 실패: ${e.message}`,
      })
    }
  }

  /**
   * 티스토리 로그인 처리 함수
   */
  private async handleLogin(page: Page, kakaoId?: string, kakaoPw?: string): Promise<void> {
    // 로그인 상태 확인 및 처리
    const currentUrl = page.url()
    if (currentUrl.includes('tistory.com/auth/login')) {
      this.logger.log('티스토리 로그인 페이지 감지, 카카오 계정으로 로그인 시도')
      try {
        await page.waitForSelector('.btn_login.link_kakao_id', { timeout: 10000 })
        await page.click('.btn_login.link_kakao_id')
        await page.waitForURL('**/accounts.kakao.com/**', { timeout: 15000 })
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_LOGIN_FAILED, {
          message: `티스토리 로그인 버튼 클릭 실패: ${e.message}`,
        })
      }
    }

    if (page.url().includes('accounts.kakao.com/login')) {
      this.logger.log('카카오 로그인 폼 감지, 계정 입력')
      try {
        await page.waitForSelector('input[name="loginId"]', { timeout: 10000 })
        await page.fill('input[name="loginId"]', kakaoId || 'busidev22@gmail.com')
        await page.waitForSelector('input[name="password"]', { timeout: 10000 })
        await page.fill('input[name="password"]', kakaoPw || 'tkfkdgo1')
        await page.waitForSelector('button[type="submit"].btn_g.highlight.submit', { timeout: 10000 })
        await page.click('button[type="submit"].btn_g.highlight.submit')
        await page.waitForURL('**/**.tistory.com/**', { timeout: 15000 })
        this.logger.log('카카오 로그인 완료')
        // 로그인 성공 후 쿠키 저장
        await this.saveCookie(page, kakaoId)
        // 로그인 후 세션 안정화를 위한 대기
        await page.waitForTimeout(1000)
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_LOGIN_FAILED, {
          message: `카카오 로그인 실패: ${e.message}`,
        })
      }
    }
  }

  /**
   * 브라우저 초기화 및 로그인 처리
   */
  async initializeBrowserWithLogin(kakaoId?: string, tistoryUrl?: string): Promise<{ browser: Browser; page: Page }> {
    const launchOptions: LaunchOptions = {
      headless: false,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=ko-KR,ko',
      ],
    }
    const browser = await chromium.launch(launchOptions)
    const page: Page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    })

    // 자동화 탐지 방지
    await page.addInitScript(() => {
      // webdriver 속성 제거
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })

      // chrome 속성 수정
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })

      // languages 속성 수정
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en'],
      })

      // permissions 속성 추가
      Object.defineProperty(navigator, 'permissions', {
        get: () => ({
          query: async () => ({ state: 'granted' }),
        }),
      })
    })

    // User-Agent 설정 (더 현실적인 값)
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    })

    // window.confirm(임시글) 핸들러: 임시글 관련 메시지면 취소
    page.on('dialog', async dialog => {
      const msg = dialog.message()
      if (msg.includes('저장된 글이 있습니다.')) {
        this.logger.warn('임시글 관련 confirm 감지, 자동 취소')
        await dialog.dismiss()
      } else {
        await dialog.accept()
      }
    })

    // 2. 쿠키 불러오기
    await this.loadCookie(browser, kakaoId)

    // 3. 로그인 체크
    if (tistoryUrl) {
      try {
        // ${tistoryUrl}/manage/newpost 등 인증필요페이지 접속
        const newPostUrl = path.join(tistoryUrl, '/manage/newpost')
        await page.goto(newPostUrl, { waitUntil: 'networkidle', timeout: 60000 })
        this.logger.log('티스토리 새글 작성 페이지 접속 완료')

        // 권한없음 상태 체크
        const hasPermissionError = await page.evaluate(() => {
          const errorElement = document.querySelector('#mArticle .content_error')
          return errorElement !== null
        })

        if (hasPermissionError) {
          this.logger.log('권한없음 상태 감지 - #mArticle .content_error 요소 존재, 로그인 페이지로 이동')
          // 로그인 페이지로 이동
          await page.goto('https://www.tistory.com/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
          // 로그인 처리
          await this.handleLogin(page, kakaoId)
        }

        // 현재 URL 확인하여 로그인 필요 상태 체크
        const currentUrl = page.url()
        if (currentUrl.includes('tistory.com/auth/login')) {
          this.logger.log('로그인 필요 상태 감지 - https://www.tistory.com/auth/login 페이지로 리다이렉트됨')
          // 4. 티스토리 로그인
          await this.handleLogin(page, kakaoId)
        } else {
          this.logger.log('이미 로그인된 상태로 확인됨')
        }
      } catch (error) {
        this.logger.error('로그인 체크 중 오류:', error)
        // 로그인 페이지로 리다이렉트된 경우 로그인 처리
        if (page.url().includes('tistory.com/auth/login')) {
          this.logger.log('로그인 필요 상태 감지')
          await this.handleLogin(page, kakaoId)
        }
      }
    } else {
      // tistoryUrl이 제공되지 않은 경우는 에러처리
      throw new Error('tistoryUrl 필수')
    }

    return { browser, page }
  }

  async closeBrowserSession(browser: Browser): Promise<void> {
    try {
      await browser.close()
      this.logger.log('브라우저 세션 종료 완료')
    } catch (error) {
      this.logger.error('브라우저 세션 종료 중 오류:', error)
    }
  }

  /**
   * 복수 이미지 업로드 처리
   */
  async uploadImages(page: Page, tistoryUrl: string, imagePaths: string[]): Promise<string[]> {
    const uploadedImageUrls: string[] = []

    try {
      const newPostUrl = path.join(tistoryUrl, `/manage/newpost`)
      await page.goto(newPostUrl, { waitUntil: 'networkidle', timeout: 60000 })
      this.logger.log('티스토리 새글 작성 페이지 접속 완료')

      // HTML 모드로 전환
      await this.switchToHtmlMode(page)

      // 각 이미지 파일 업로드
      try {
        // 1. 이미지 업로드
        await page.waitForSelector('#attach-layer-btn', { timeout: 10000 })
        await page.click('#attach-layer-btn')
        await page.waitForSelector('#attach-image', { timeout: 10000 })
        const fileInput = await page.$('#attach-image')

        assert(fileInput, '#attach-image input을 찾을 수 없습니다')
        await fileInput.setInputFiles(imagePaths)
        this.logger.log(`이미지 첨부: ${imagePaths.join('\n')}`)
        await page.waitForTimeout(3000) // 업로드 완료 대기

        // 2. 에디터에서 이미지 URL 추출
        const imageUrls = await page.evaluate(() => {
          const codeMirror = document.querySelector('.CodeMirror-code')
          if (!codeMirror) {
            throw new Error('CodeMirror 에디터를 찾을 수 없습니다')
          }
          const text = codeMirror.textContent || ''
          // 티스토리 이미지 형식 [##_Image|...|_##] 전체 추출
          const imageMatches = text.match(/\[##_Image\|.*?_##\]/g)
          return imageMatches?.filter(tag => tag !== '') || []
        })

        if (imageUrls.length > 0) {
          uploadedImageUrls.push(...imageUrls)
          this.logger.log(`이미지 업로드 완료: ${imageUrls.join(', ')}`)
        }
      } catch (error) {
        this.logger.error(`이미지 업로드 중 오류 (${imagePaths.join('\n')}):`, error)
      }

      this.logger.log(`총 ${uploadedImageUrls.length}개 이미지 업로드 완료`)
      return uploadedImageUrls
    } catch (error) {
      this.logger.error('복수 이미지 업로드 중 오류:', error)
      return uploadedImageUrls
    }
  }

  /**
   * 브라우저 세션을 내부적으로 관리하는 복수 이미지 업로드 메서드
   */
  async uploadImagesWithBrowser(imagePaths: string[], tistoryUrl: string, kakaoId?: string): Promise<string[]> {
    const { browser, page } = await this.initializeBrowserWithLogin(kakaoId, tistoryUrl)

    try {
      // 복수 이미지 업로드 수행
      const imageUrls = await this.uploadImages(page, tistoryUrl, imagePaths)

      return imageUrls
    } catch (error) {
      this.logger.error('복수 이미지 업로드 세션 중 오류:', error)
      return []
    } finally {
      // 브라우저 세션 종료
      if (browser) {
        await this.closeBrowserSession(browser)
      }
    }
  }

  /**
   * 캡챠 감지 함수
   */
  private async detectCaptcha(page: Page): Promise<boolean> {
    try {
      // 캡챠 레이어 존재 확인
      const captchaLayer = await page.$('.capcha_layer')
      if (!captchaLayer) {
        return false
      }

      // iframe src 확인
      const iframe = await page.$('.capcha_layer iframe')
      if (!iframe) {
        return false
      }

      const iframeSrc = await iframe.getAttribute('src')
      if (!iframeSrc || !iframeSrc.includes('dkaptcha.kakao.com/dkaptcha/quiz')) {
        return false
      }

      this.logger.log('캡챠 감지됨')
      return true
    } catch (error) {
      this.logger.error('캡챠 감지 중 오류:', error)
      return false
    }
  }

  /**
   * 캡챠 자동 해결 함수
   */
  private async solveCaptcha(page: Page): Promise<boolean> {
    try {
      this.logger.log('캡챠 자동 해결 시작')

      // iframe으로 전환
      const iframe = await page.$('.capcha_layer iframe')
      assert(iframe, '캡챠 iframe을 찾을 수 없습니다')

      const frame = await iframe.contentFrame()
      assert(frame, '캡챠 iframe 내용에 접근할 수 없습니다')

      // 질문 텍스트 추출
      const questionText = await frame.evaluate(() => {
        const txtQuestion = document.querySelector('.txt_question')?.textContent?.trim() || ''
        const infoQuestion = document.querySelector('.info_question')?.textContent?.trim() || ''
        return `${txtQuestion} ${infoQuestion}`.trim()
      })

      this.logger.log(`캡챠 질문 텍스트: ${questionText}`)

      // 이미지 요소만 찾기
      const imageElement = await frame.$('img')
      assert(imageElement, '캡챠 이미지를 찾을 수 없습니다')

      // 이미지 스크린샷 촬영
      const screenshotPath = path.join(EnvConfig.tempDir, `captcha-${Date.now()}.png`)
      const tempDir = path.dirname(screenshotPath)
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      await imageElement.screenshot({
        path: screenshotPath,
        type: 'png',
      })

      this.logger.log(`캡챠 이미지 스크린샷 저장: ${screenshotPath}`)

      // 이미지를 base64로 인코딩
      const imageBuffer = fs.readFileSync(screenshotPath)
      const base64Image = imageBuffer.toString('base64')

      // Gemini AI로 캡챠 해결 (이미지와 텍스트 모두 전달)
      const answer = await this.solveCaptchaWithAI(base64Image, questionText)

      if (!answer) {
        throw new Error('AI로 캡챠 답변을 생성할 수 없습니다')
      }

      // 답변 입력
      this.logger.log(`캡챠 답변 입력: ${answer}`)
      await frame.focus('#inpDkaptcha')
      await page.keyboard.type(answer)
      await frame.dispatchEvent('#inpDkaptcha', 'keyup')

      // 확인 버튼 클릭
      const confirmButton = await frame.$('#btn_dkaptcha_submit')
      if (confirmButton) {
        await confirmButton.click()
        this.logger.log('캡챠 확인 버튼 클릭')
      }

      // 임시 파일 삭제
      try {
        fs.unlinkSync(screenshotPath)
      } catch (error) {
        this.logger.warn('캡챠 스크린샷 파일 삭제 실패:', error)
      }

      // 캡챠 해결 완료 대기
      await page.waitForTimeout(2000)

      // 캡챠가 사라졌는지 확인
      const captchaStillExists = await this.detectCaptcha(page)
      if (captchaStillExists) {
        this.logger.warn('캡챠가 여전히 존재합니다. 답변이 틀렸을 수 있습니다')
        return false
      }

      this.logger.log('캡챠 자동 해결 완료')
      return true
    } catch (error) {
      this.logger.error('캡챠 자동 해결 실패:', error)
      return false
    }
  }

  /**
   * AI를 사용하여 캡챠 해결
   */
  private async solveCaptchaWithAI(base64Image: string, questionText?: string): Promise<string | null> {
    try {
      const gemini = await this.geminiService.getGemini()

      const prompt = `
이미지는 카카오 지도 캡챠(보안 문자)입니다. 
이미지에 보이는 질문과 이미지를 분석하여 정답만을 반환해주세요.
빈칸이라는 글자는 말글대로 빈칸이며 1~N개의 글자입니다.(반드시 1글자만은 아님 주의) 

${questionText ? `질문: ${questionText}` : ''}

예시:
- 질문: 지도에서 아래 장소를 찾아 빈칸에 들어갈 글자를 입력해주세요. 공_ 빈대떡
- 답변: 항
- 해석: 공항 빈대떡이라는게 지도에 있었음

주의사항:
1. 정답만 반환하세요 (설명 없이)
`

      const result = await gemini.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        config: {
          maxOutputTokens: 50,
        },
      })

      const answer = result.text?.trim()
      this.logger.log(`AI 캡챠 답변: ${answer}`)
      return answer || null
    } catch (error) {
      this.logger.error('AI 캡챠 해결 실패:', error)
      return null
    }
  }

  async publish(options: TistoryPostOptions): Promise<{ success: boolean; message: string; url?: string }> {
    const { title, contentHtml, tistoryUrl, keywords, category, kakaoId } = options

    const { browser, page } = await this.initializeBrowserWithLogin(kakaoId, tistoryUrl)

    try {
      const newPostUrl = path.join(tistoryUrl, '/manage/newpost')
      await page.goto(newPostUrl, { waitUntil: 'networkidle', timeout: 60000 })

      // HTML 모드로 전환
      await this.switchToHtmlMode(page)

      // 1-2. 카테고리 선택 (선택적)
      if (category) {
        try {
          await page.waitForSelector('#category-btn', { timeout: 10000 })
          await page.click('#category-btn')
          this.logger.log('카테고리 버튼 클릭')
          // 드롭다운 내에서 카테고리명으로 항목 찾기
          await page.waitForSelector('#category-list', { timeout: 10000 })
          await page.waitForSelector('#category-list>[role=option]', { timeout: 10000 })

          try {
            // #category-list>[role=option] 범위 내에서 정확한 텍스트로 카테고리 찾기
            const categoryElement = page.locator('#category-list>[role=option]').getByText(category, { exact: true })
            await categoryElement.waitFor({ timeout: 5000 })
            await categoryElement.click()
            this.logger.log(`카테고리 선택: ${category}`)
          } catch (error) {
            this.logger.warn(`카테고리 '${category}'를 찾을 수 없습니다`)

            await page.click('#category-btn')
          }
        } catch (e) {
          this.logger.warn('카테고리 선택 중 오류: ' + e.message)
          this.logger.warn(`카테고리 선택 실패: ${e.message}`)
        }
      }

      // 2. 제목 입력
      try {
        await page.waitForSelector('#post-title-inp', { timeout: 10000 })
        await page.fill('#post-title-inp', title)
        this.logger.log('제목 입력')
        await page.waitForTimeout(1000)
        this.logger.log('제목 입력 완료')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
          message: `제목 입력 실패: ${e.message}`,
        })
      }

      // 3. 본문 입력 (HTML 모드: CodeMirror 안전 타이핑)
      // 3. 본문 입력
      try {
        await page.waitForSelector('.CodeMirror', { timeout: 10000 })
        // HTML 모드 전환 후 살짝 대기
        await page.waitForTimeout(500)
        // CodeMirror 에디터 영역 클릭
        await page.waitForSelector('.CodeMirror-code', { timeout: 10000 })
        await page.click('.CodeMirror-code')
        await page.waitForTimeout(500)
        // 전체 선택 후 삭제
        await page.keyboard.insertText(contentHtml)
        await page.keyboard.down('Enter')
        this.logger.log('본문(HTML) 입력')
        await page.waitForTimeout(1000)
        this.logger.log('본문 입력 완료')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
          message: `본문 입력 실패: ${e.message}`,
        })
      }

      // 3-1. 이미지 첨부 (옵션)
      if (options.imagePaths && options.imagePaths.length > 0) {
        const uploadedImageUrls: string[] = []

        // 각 이미지 파일 업로드
        for (const imagePath of options.imagePaths) {
          try {
            // 첨부 버튼 클릭해서 input[type=file] 생성
            await page.waitForSelector('#attach-layer-btn', { timeout: 10000 })
            await page.click('#attach-layer-btn')
            // input[type=file]이 동적으로 생성될 때까지 대기
            await page.waitForSelector('#attach-image', { timeout: 10000 })
            const fileInput = await page.$('#attach-image')
            assert(fileInput, '#attach-image input을 찾을 수 없습니다')
            await fileInput.setInputFiles(imagePath)
            this.logger.log(`이미지 첨부: ${imagePath}`)
            // 업로드 완료 대기
            await page.waitForTimeout(3000)
          } catch (e) {
            this.logger.warn(`이미지 업로드 실패 (${imagePath}): ${e.message}`)
          }
        }

        // 업로드된 이미지 URL을 본문에 삽입
        if (uploadedImageUrls.length > 0) {
          const imageHtml = uploadedImageUrls.map(url => `[${url}]`).join('\n')
          const updatedContentHtml = contentHtml + '\n\n' + imageHtml

          // 본문 다시 입력
          await page.click('.CodeMirror-code')
          await page.waitForTimeout(500)
          await page.keyboard.press('Control+A')
          await page.keyboard.press('Backspace')
          await page.keyboard.type(updatedContentHtml)
          this.logger.log('업로드된 이미지 URL을 본문에 삽입 완료')
        }
      }

      // 4. 태그 입력
      try {
        await page.waitForSelector('#tagText', { timeout: 10000 })
        await page.click('#tagText')
        this.logger.log('태그 입력 시작')
        for (const keyword of keywords.slice(0, 10)) {
          await page.fill('#tagText', keyword)
          await page.keyboard.press('Enter')
          await page.waitForTimeout(100)
        }
        this.logger.log('태그 입력 완료')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
          message: `태그 입력 실패: ${e.message}`,
        })
      }

      // 5. 게시 버튼 클릭
      try {
        await page.waitForTimeout(1000)
        await page.waitForSelector('#publish-layer-btn', { timeout: 10000 })
        await page.click('#publish-layer-btn')
        this.logger.log('게시 버튼 클릭')
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_ELEMENT_NOT_FOUND, {
          message: `게시 버튼 클릭 실패: ${e.message}`,
        })
      }

      // 6. 발행 팝업 처리: 썸네일 등록, 공개범위 선택, 공개 발행 버튼 클릭
      try {
        await page.waitForTimeout(1000)
        await page.waitForSelector('.ReactModal__Content.editor_layer', { timeout: 10000 })

        // 썸네일 등록 (옵션)
        if (options.thumbnailPath) {
          try {
            // 썸네일 등록 버튼 찾기 및 클릭
            await page.waitForSelector('input[type="file"]', { timeout: 10000 })
            const thumbnailInput = await page.$('input[type="file"]')
            assert(thumbnailInput, '썸네일 등록 input을 찾을 수 없습니다')
            await thumbnailInput.setInputFiles(options.thumbnailPath)
            this.logger.log(`썸네일 등록: ${options.thumbnailPath}`)
            // 썸네일 업로드 완료 대기
            await page.waitForTimeout(3000)
          } catch (e) {
            this.logger.warn(`썸네일 등록 실패 (${options.thumbnailPath}): ${e.message}`)
          }
        }

        // 공개/비공개/보호 라디오버튼 선택
        const visibility = options.postVisibility || 'public'
        let radioSelector = '#open20' // 공개
        switch (visibility) {
          case 'private':
            radioSelector = '#open0'
            break
          case 'protected':
            radioSelector = '#open15'
            break
          case 'public':
          default:
            radioSelector = '#open20'
            break
        }
        await page.waitForSelector(radioSelector, { timeout: 10000 })
        await page.evaluate(sel => {
          const radio = document.querySelector(sel) as HTMLInputElement
          if (radio && !radio.checked) radio.click()
        }, radioSelector)
        this.logger.log(
          `${visibility === 'public' ? '공개' : visibility === 'private' ? '비공개' : '보호'} 라디오버튼 선택`,
        )
        // 공개 발행 버튼 클릭
        await page.waitForSelector('#publish-btn', { timeout: 10000 })
        await page.click('#publish-btn')
        this.logger.log('공개 발행 버튼 클릭')

        // 캡챠 감지 및 자동 해결 (최대 3회 재시도)
        await page.waitForTimeout(2000) // 캡챠 로딩 대기
        const hasCaptcha = await this.detectCaptcha(page)
        if (hasCaptcha) {
          this.logger.log('캡챠 감지됨, 자동 해결 시도 (최대 3회)')

          try {
            const captchaSolved = await retry(
              async () => {
                const solved = await this.solveCaptcha(page)
                if (!solved) {
                  throw new Error('캡챠 해결 실패')
                }
                return solved
              },
              2000,
              3,
              'linear',
            )

            this.logger.log('캡챠 자동 해결 완료')
          } catch (error) {
            throw new CustomHttpException(ErrorCode.TISTORY_CAPTCHA_FAILED, {
              message: '캡챠 자동 해결에 실패했습니다. (3회 시도 후 실패) 수동으로 해결해주세요.',
            })
          }
        }
      } catch (e) {
        throw new CustomHttpException(ErrorCode.TISTORY_POST_FAILED, {
          message: `발행 팝업 처리 실패: ${e.message}`,
        })
      }

      // 7. 게시 성공 확인(간단히 3초 대기)
      await page.waitForTimeout(3000)

      // 8. 등록된 글의 URL 추출
      let postUrl = null
      // 등록 대상 블로그 도메인 추출
      const urlObj = new URL(tistoryUrl)
      const manageUrl = path.join(urlObj.origin, '/manage/posts/')
      await page.goto(manageUrl, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForSelector('.wrap_list .list_post .post_cont .tit_post a', { timeout: 10000 })
      postUrl = await page.evaluate(title => {
        const items = document.querySelectorAll('.wrap_list .list_post .post_cont .tit_post a')
        if (items.length === 0) {
          throw new Error('포스트 목록을 찾을 수 없습니다')
        }
        for (const a of Array.from(items)) {
          const text = a.textContent?.replace(/\s+/g, ' ').trim()
          if (!text) {
            throw new Error('포스트 제목을 가져올 수 없습니다')
          }
          if (title && text.includes(title)) {
            return a.getAttribute('href')
          }
        }
        return null
      }, title)
      return { success: true, message: '티스토리 블로그 글 등록 성공', url: postUrl }
    } catch (e) {
      this.logger.error('티스토리 블로깅 실패: ' + e.message)
      if (e instanceof CustomHttpException) {
        throw e
      }
      throw new CustomHttpException(ErrorCode.TISTORY_POST_FAILED, {
        message: `티스토리 블로깅 실패: ${e.message}`,
      })
    } finally {
      if (browser) {
        try {
          await browser.close()
        } catch {}
      }
    }
  }
}
