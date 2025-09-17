import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, Page } from 'playwright'
import fs from 'fs'
import path from 'path'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { TistoryPostOptions } from '@main/app/modules/tistory/tistory.types'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { retry } from '@main/app/utils/retry'
import { EnvConfig } from '@main/config/env.config'
import { mapPublishedUrl } from '@main/app/utils/url-mapping.util'
import { BrowserErrorHandler } from '@main/app/utils/browser-error-handler'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

@Injectable()
export class TistoryAutomationService {
  private readonly logger = new Logger(TistoryAutomationService.name)

  constructor(
    private readonly geminiService: GeminiService,
    private readonly browserErrorHandler: BrowserErrorHandler,
  ) {}

  public async publish(options: TistoryPostOptions): Promise<{ success: boolean; message: string; url?: string }> {
    const { title, contentHtml, tistoryUrl, keywords, category, kakaoId, kakaoPw } = options

    const { browser, page } = await this.initializeBrowserWithLogin({
      kakaoId,
      kakaoPw,
      tistoryUrl,
    })

    try {
      // 새글 작성 페이지로 이동
      const newPostUrl = new URL('/manage/newpost', tistoryUrl).toString()
      await page.goto(newPostUrl, { waitUntil: 'networkidle', timeout: 60000 })

      // HTML 모드로 전환
      await this._switchToHtmlMode(page)

      // 1. 카테고리 선택 (선택적)
      await this._selectCategory(page, category)

      // 2. 제목 입력
      await this._inputTitle(page, title)

      // 3. 본문 입력
      await this._inputContent(page, contentHtml)

      // 4. 이미지 첨부 (옵션)
      await this._uploadImages(page, options.imagePaths, contentHtml)

      // 5. 태그 입력
      await this._inputTags(page, keywords)

      // 6. 게시 버튼 클릭
      await this._clickPublishButton(page)

      // 7. 발행 팝업 처리
      await this._handlePublishPopup(page, options)

      // 8. 캡챠 처리
      await this._handleCaptcha(page)

      // 9. 게시된 글 URL 추출 및 매핑
      const mappedUrl = await this._extractPostUrl(page, title, tistoryUrl)

      return { success: true, message: '티스토리 블로그 글 등록 성공', url: mappedUrl }
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  }

  /**
   * 브라우저 초기화 및 로그인 처리
   */
  public async initializeBrowserWithLogin({
    kakaoId,
    kakaoPw,
    tistoryUrl,
    headless = EnvConfig.getPlaywrightHeadless(),
  }: {
    kakaoId: string
    kakaoPw: string
    tistoryUrl: string
    headless?: boolean
  }): Promise<{ browser: Browser; page: Page }> {
    let browser: Browser
    try {
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
    } catch (error) {
      this.browserErrorHandler.handleBrowserError(error)
    }

    const page: Page = await browser.newPage()

    // 실제 브라우저 UA 사용, 한국어 우선 헤더만 적용
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9',
    })

    // 뷰포트 설정
    await page.setViewportSize({ width: 1920, height: 1080 })

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
    await this._loadCookie(browser, kakaoId)

    // 3. 로그인 체크
    // ${tistoryUrl}/manage/newpost 등 인증필요페이지 접속
    const newPostUrl = new URL('/manage/newpost', tistoryUrl).toString()
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
      await this._handleLogin(page, kakaoId, kakaoPw)
    }

    // 현재 URL 확인하여 로그인 필요 상태 체크
    const currentUrl = page.url()
    if (currentUrl.includes('tistory.com/auth/login')) {
      this.logger.log('로그인 필요 상태 감지 - https://www.tistory.com/auth/login 페이지로 리다이렉트됨')
      // 4. 티스토리 로그인
      await this._handleLogin(page, kakaoId, kakaoPw)
    } else {
      this.logger.log('이미 로그인된 상태로 확인됨')
    }

    // 로그인 처리 완료 후 새글 작성 페이지 재접속 확인
    await page.goto(newPostUrl, { waitUntil: 'networkidle', timeout: 60000 })
    this.logger.log('로그인 후 새글 작성 페이지 재접속 완료')

    // 최종 접속 성공 여부 확인
    const finalUrl = page.url()
    const finalHasPermissionError = await page.evaluate(() => {
      const errorElement = document.querySelector('#mArticle .content_error')
      return errorElement !== null
    })

    if (finalHasPermissionError || finalUrl.includes('tistory.com/auth/login')) {
      throw new CustomHttpException(ErrorCode.TISTORY_LOGIN_FAILED, {
        message: '로그인 후에도 새글 작성 페이지에 접근할 수 없습니다. 계정 권한을 확인해주세요.',
      })
    }

    this.logger.log('로그인 및 새글 작성 페이지 접속 성공')

    return { browser, page }
  }

  public async closeBrowserSession(browser: Browser): Promise<void> {
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
  public async uploadImages(page: Page, tistoryUrl: string, imagePaths: string[]): Promise<string[]> {
    const uploadedImageUrls: string[] = []

    try {
      const newPostUrl = new URL('/manage/newpost', tistoryUrl).toString()
      await page.goto(newPostUrl, { waitUntil: 'networkidle', timeout: 60000 })
      this.logger.log('티스토리 새글 작성 페이지 접속 완료')

      // HTML 모드로 전환
      await this._switchToHtmlMode(page)

      // 각 이미지 파일 업로드
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

      this.logger.log(`총 ${uploadedImageUrls.length}개 이미지 업로드 완료`)
      return uploadedImageUrls
    } catch (error) {
      this.logger.error(`이미지 업로드 중 오류 (${imagePaths.join('\n')}):`, error)
      throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, {
        message: `티스토리 이미지 업로드 실패: ${error.message}`,
        details: {
          imagePaths,
          uploadedCount: uploadedImageUrls.length,
        },
      })
    }
  }

  /**
   * 브라우저 세션을 내부적으로 관리하는 복수 이미지 업로드 메서드
   */
  public async uploadImagesWithBrowser(
    imagePaths: string[],
    tistoryUrl: string,
    kakaoId: string,
    kakaoPw: string,
  ): Promise<string[]> {
    const { browser, page } = await this.initializeBrowserWithLogin({
      kakaoId,
      kakaoPw,
      tistoryUrl,
    })

    try {
      // 복수 이미지 업로드 수행
      const imageUrls = await this.uploadImages(page, tistoryUrl, imagePaths)

      return imageUrls
    } catch (error) {
      this.logger.error('복수 이미지 업로드 세션 중 오류:', error)
      // 에러를 다시 throw하여 호출하는 쪽에서 처리할 수 있도록 함
      throw error
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
  private async _detectCaptcha(page: Page): Promise<boolean> {
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
  private async _solveCaptcha(page: Page): Promise<boolean> {
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
      const answer = await this._solveCaptchaWithAI(base64Image, questionText)

      if (!answer) {
        throw new Error('AI로 캡챠 답변을 생성할 수 없습니다')
      }

      // 답변 입력
      this.logger.log(`캡챠 답변 입력: ${answer}`)
      await frame.focus('#inpDkaptcha')
      // 전체 선택 후 삭제
      await page.keyboard.press('Control+A')
      await page.keyboard.press('Backspace')
      await page.keyboard.insertText(answer)
      await page.keyboard.press('Enter')
      this.logger.log('캡챠 답변 입력 완료')
      await page.waitForTimeout(1000)

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
      const captchaStillExists = await this._detectCaptcha(page)
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
  private async _solveCaptchaWithAI(base64Image: string, questionText?: string): Promise<string | null> {
    try {
      const gemini = await this.geminiService.getGemini()

      // 캡챠 유형 판별
      const isFullText = questionText?.includes('전체')
      const isPartialText = questionText?.includes('빈칸')

      // 프롬프트 정의
      let prompt = ''

      if (isFullText) {
        // 전체글자 유형
        prompt = `당신은 카카오 지도 캡챠 해석을 위한 OCR 도우미입니다.

📌 역할 및 목적:
- 이미지에 표시된 실제 지도 장소명을 정확히 읽어내는 것
- 질문에서 "전체 명칭"을 요구할 때는 장소 이름 전체를 그대로 반환
- 오직 정답만 출력 (설명, 이유, 추가 단어, 문장 금지)

⚠️ 출력 규칙:
- 반드시 실제 장소명과 동일하게 작성
- 공백, 특수문자, 띄어쓰기까지 동일해야 함
- 다른 텍스트(예: "정답:", "답은", 따옴표 등) 절대 금지

예시:
- 질문: 지도에 있는 초등학교의 전체 명칭을 입력해주세요
- 이미지에 표시된 글씨: "평촌초등학교"
- 출력: 평촌초등학교

- 질문: 지도에 있는 오피스텔의 전체 명칭을 입력해주세요
- 이미지에 표시된 글씨: "미씨엘로 오피스텔"
- 출력: 미씨엘로 오피스텔

지도 이미지에서 해당 장소의 전체 명칭을 정확히 읽어주세요.

${questionText ? `질문: ${questionText}` : ''}`
      } else if (isPartialText) {
        // 부분글자 유형
        prompt = `당신은 카카오 지도 캡챠 해석을 위한 OCR 도우미입니다.

📌 역할 및 목적:
- 이미지에 표시된 실제 지도 장소명을 정확히 읽어내는 것
- 질문에 있는 장소명에서 빈칸(__)에 들어갈 글자만 정확히 추출
- 전체 단어가 아니라 빈칸 부분에 들어갈 글자만 출력
- 오직 정답만 출력 (설명, 이유, 문장 금지)

⚠️ 출력 규칙:
- 빈칸 부분만 작성 (예: "__빌라" → "빌")
- 질문 문구, 불필요한 텍스트, 따옴표 절대 금지
- 글자 수는 "_" 개수와 무관 (실제 명칭 기준)

예시:
- 질문: 공__ 빈대떡
- 이미지에 표시된 글씨: 공항 빈대떡
- 출력: 항

- 질문: 라곤__ 떡볶이
- 이미지에 표시된 글씨: 라곤치킨 떡볶이
- 출력: 치킨

- 질문: 치킨__막
- 이미지에 표시된 글씨: 치킨주막
- 출력: 주

지도 이미지에서 빈칸에 들어갈 글자를 정확히 추출해주세요.

${questionText ? `질문: ${questionText}` : ''}`
      } else {
        // 기본 유형
        prompt = `당신은 카카오 지도 캡챠 해석을 위한 OCR 도우미입니다.

📌 역할 및 목적:
- 이미지에 표시된 실제 지도 장소명을 정확히 읽어내는 것
- 질문에 정확히 맞는 답변만 출력
- 오직 정답만 출력 (설명, 이유, 추가 단어 금지)

⚠️ 출력 규칙:
- 반드시 실제 장소명과 동일하게 작성
- 다른 텍스트(예: "정답:", "답은", 따옴표 등) 절대 금지

지도 이미지에서 질문에 맞는 답변을 정확히 읽어주세요.

${questionText ? `질문: ${questionText}` : ''}`
      }

      const result = await retry(
        () =>
          gemini.models.generateContent({
            model: 'gemini-1.5-pro',
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
          }),
        10000, // 10초 간격
        5, // 최대 5회 재시도
        'linear',
      )

      const answer = result.text?.trim()
      this.logger.log(`AI 캡챠 답변: ${answer}`)

      // 답변 정제 (불필요한 문자 제거)
      if (answer) {
        // 따옴표나 특수문자 제거
        const cleanedAnswer = answer.replace(/["""'']/g, '').trim()
        this.logger.log(`정제된 캡챠 답변: ${cleanedAnswer}`)
        return cleanedAnswer || null
      }

      return null
    } catch (error) {
      this.logger.error('AI 캡챠 해결 실패:', JSON.parse(error.message).error)
      return null
    }
  }

  private _getCookiePath(kakaoId: string = 'default'): string {
    const cookieDir = path.join(EnvConfig.userDataCustomPath, 'cookies')
    if (!fs.existsSync(cookieDir)) fs.mkdirSync(cookieDir, { recursive: true })
    const kakaoIdForFile = kakaoId.replace(/[^a-zA-Z0-9_\-]/g, '_')
    return path.join(cookieDir, `tistory_${kakaoIdForFile}.json`)
  }

  private async _loadCookie(browser: Browser, kakaoId: string): Promise<boolean> {
    try {
      const cookiePath = this._getCookiePath(kakaoId)
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

  private async _saveCookie(page: Page, kakaoId: string = 'default'): Promise<void> {
    try {
      const cookiePath = this._getCookiePath(kakaoId)
      const cookies = await page.context().cookies()
      fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf-8')
      this.logger.log('로그인 후 쿠키 저장 완료')
    } catch (error) {
      this.logger.error('쿠키 저장 중 오류:', error)
    }
  }

  private async _switchToHtmlMode(page: Page): Promise<void> {
    try {
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

  private async _detectSecondAuth(page: Page): Promise<boolean> {
    const secondAuthElement = await page.$('#mainContent .login_certify')
    if (!secondAuthElement) {
      return false
    }

    const titleText = await page.evaluate(() => {
      const titleElement = document.querySelector('#mainContent .tit_g.tit_certify')
      return titleElement?.textContent?.trim() || ''
    })

    if (titleText.includes('2단계 인증')) {
      this.logger.warn('카카오톡 2차인증이 감지되었습니다')
      return true
    }

    return false
  }

  private async _handleSecondAuthCheckbox(page: Page): Promise<void> {
    this.logger.log('2단계 인증 사용안함 체크박스 처리 시작')

    const checkboxSelector = 'input[name="isRememberBrowser"]'
    const checkbox = await page.$(checkboxSelector)

    if (checkbox) {
      const isChecked = await page.isChecked(checkboxSelector)
      if (!isChecked) {
        await page.evaluate(selector => {
          const checkbox = document.querySelector(selector) as HTMLInputElement
          if (checkbox && !checkbox.checked) {
            checkbox.checked = true
            checkbox.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }, checkboxSelector)

        this.logger.log('2단계 인증 사용안함 체크박스를 체크했습니다')
        await page.waitForTimeout(1000)
      } else {
        this.logger.log('2단계 인증 사용안함 체크박스가 이미 체크되어 있습니다')
      }
    } else {
      this.logger.warn('2단계 인증 사용안함 체크박스를 찾을 수 없습니다')
    }
  }

  private async _handleLogin(page: Page, kakaoId?: string, kakaoPw?: string): Promise<void> {
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
      await page.waitForSelector('input[name="loginId"]', { timeout: 10000 })
      await page.fill('input[name="loginId"]', kakaoId)
      await page.waitForSelector('input[name="password"]', { timeout: 10000 })
      await page.fill('input[name="password"]', kakaoPw)
      await page.waitForSelector('button[type="submit"].btn_g.highlight.submit', { timeout: 10000 })
      await page.click('button[type="submit"].btn_g.highlight.submit')

      await page.waitForTimeout(3000)

      const hasSecondAuth = await this._detectSecondAuth(page)
      if (hasSecondAuth) {
        this.logger.log('2차인증 페이지 감지, 체크박스 자동 체크 처리')
        await this._handleSecondAuthCheckbox(page)
      }

      // 연락처 등록 캠페인(전화번호 등록) 화면이 노출되면 "다음에 할게요"로 건너뛰기
      await this._maybeSkipContactRegistration(page)

      await page.waitForURL('**/**.tistory.com/**', { timeout: 300_000 })
      this.logger.log('카카오 로그인 완료')
      await this._saveCookie(page, kakaoId)
      await page.waitForTimeout(1000)
    }
  }

  /**
   * 카카오 계정의 연락처 등록 캠페인 페이지가 표시될 경우 "다음에 할게요" 클릭하여 건너뛴다
   */
  private async _maybeSkipContactRegistration(page: Page): Promise<void> {
    try {
      // 캠페인 섹션 존재 여부를 짧게 탐지
      const exists = await page.$('#mainContent .campaign_contact')
      if (!exists) return

      this.logger.log('연락처 등록 캠페인 화면 감지, "다음에 할게요" 클릭 시도')

      // 버튼 클릭 (텍스트 매칭으로 안전하게 처리)
      await page.evaluate(() => {
        const root = document.querySelector('#mainContent .campaign_contact') as HTMLElement | null
        if (!root) return
        const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[]
        const skip = buttons.find(btn => (btn.textContent || '').includes('다음에 할게요'))
        if (skip) skip.click()
      })

      await page.waitForTimeout(1000)
      this.logger.log('연락처 등록 스킵 처리 완료')
    } catch (error) {
      this.logger.warn('연락처 등록 캠페인 스킵 처리 중 경고:', error?.message || error)
    }
  }

  /**
   * 카테고리 선택
   */
  private async _selectCategory(page: Page, category?: string): Promise<void> {
    if (!category) return

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

  /**
   * 제목 입력
   */
  private async _inputTitle(page: Page, title: string): Promise<void> {
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
  }

  /**
   * 본문 입력 (HTML 모드)
   */
  private async _inputContent(page: Page, contentHtml: string): Promise<void> {
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
  }

  /**
   * 이미지 업로드 및 본문에 삽입
   */
  private async _uploadImages(page: Page, imagePaths?: string[], contentHtml?: string): Promise<void> {
    if (!imagePaths || imagePaths.length === 0) return

    const uploadedImageUrls: string[] = []

    // 각 이미지 파일 업로드
    for (const imagePath of imagePaths) {
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
    }

    // 업로드된 이미지 URL을 본문에 삽입
    if (uploadedImageUrls.length > 0 && contentHtml) {
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

  /**
   * 태그 입력
   */
  private async _inputTags(page: Page, keywords: string[]): Promise<void> {
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
  }

  /**
   * 게시 버튼 클릭
   */
  private async _clickPublishButton(page: Page): Promise<void> {
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
  }

  /**
   * 발행 팝업 처리: 썸네일 등록, 공개범위 선택, 공개 발행 버튼 클릭
   */
  private async _handlePublishPopup(page: Page, options: TistoryPostOptions): Promise<void> {
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
  }

  /**
   * 캡챠 감지 및 자동 해결
   */
  private async _handleCaptcha(page: Page): Promise<void> {
    // 캡챠 감지 및 자동 해결 (최대 5회 재시도)
    await page.waitForTimeout(2000) // 캡챠 로딩 대기
    const hasCaptcha = await this._detectCaptcha(page)
    if (hasCaptcha) {
      this.logger.log('캡챠 감지됨, 자동 해결 시도 (최대 5회)')

      try {
        await retry(
          async () => {
            const solved = await this._solveCaptcha(page)
            if (!solved) {
              throw new Error('캡챠 해결 실패')
            }
            return solved
          },
          2000,
          5,
          'linear',
        )

        this.logger.log('캡챠 자동 해결 완료')
      } catch (error) {
        throw new CustomHttpException(ErrorCode.TISTORY_CAPTCHA_FAILED, {
          message: '캡챠 자동 해결에 실패했습니다. (5회 시도 후 실패) 수동으로 해결해주세요.',
        })
      }
    }
  }

  /**
   * 게시된 글의 URL 추출 및 매핑
   */
  private async _extractPostUrl(page: Page, title: string, tistoryUrl: string): Promise<string | null> {
    // 등록 대상 블로그 도메인 추출
    const manageUrl = new URL('/manage/posts/', tistoryUrl).toString()
    await page.goto(manageUrl, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForSelector('.wrap_list .list_post .post_cont .tit_post a', { timeout: 10000 })

    const postUrl = await page.evaluate(title => {
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

    // URL 매핑 적용 (티스토리는 기본 도메인 체크 옵션 사용)
    const mappedUrl = mapPublishedUrl(postUrl, tistoryUrl, { skipDefaultDomain: true })
    return mappedUrl
  }
}
