import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { TistoryService } from '@main/app/modules/tistory/tistory.service'
import { TistoryAutomationService } from '@main/app/modules/tistory/tistory-automation.service'
import { WordPressService } from '@main/app/modules/wordpress/wordpress.service'
import { GoogleBloggerService } from '@main/app/modules/google/blogger/google-blogger.service'
import { JobLogsService } from '@main/app/modules/job/job-logs/job-logs.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
// import { InfoBlogJob } from '@prisma/client'
import { Type } from '@google/genai'
import { GeminiService } from '@main/app/modules/ai/gemini.service'
import { Browser, chromium, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { EnvConfig } from '@main/config/env.config'
import { StorageService } from '@main/app/modules/google/storage/storage.service'
import { UtilService } from '@main/app/modules/util/util.service'
import axios from 'axios'
import {
  InfoBlogPost,
  InfoBlogPostExcelRow,
  InfoBlogPostJobStatus,
  InfoBlogPostPublish,
  LinkResult,
  ProcessedSection,
  SectionContent,
  YoutubeResult,
} from '@main/app/modules/job/info-blog-post-job/info-blog-post-job.types'
import { SearchResultItem, SearxngService } from '@main/app/modules/search/searxng.service'
import { postingContentsPrompt } from '@main/app/modules/job/info-blog-post-job/prompts'
import { ImagePixabayService } from '@main/app/modules/image-pixabay/image-pixabay.service'
import { sleep } from '@main/app/utils'
import Bottleneck from 'bottleneck'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { parse } from 'date-fns/parse'
import { isValid } from 'date-fns/isValid'
import { JobStatus, JobTargetType } from '@main/app/modules/job/job.types'
import { InfoBlogJob } from '@prisma/client'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

@Injectable()
export class InfoBlogPostJobService {
  private readonly logger = new Logger(InfoBlogPostJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly geminiService: GeminiService,
    private readonly imagePixabayService: ImagePixabayService,
    private readonly searxngService: SearxngService,
    private readonly tistoryService: TistoryService,
    private readonly tistoryAutomationService: TistoryAutomationService,
    private readonly wordpressService: WordPressService,
    private readonly googleBloggerService: GoogleBloggerService,
    private readonly jobLogsService: JobLogsService,
    private readonly storageService: StorageService,
    private readonly utilService: UtilService,
  ) {}

  /**
   * 정보 블로그 포스트 작업 처리 (메인 프로세스)
   */
  public async processJob(jobId: string): Promise<{ resultUrl?: string; resultMsg: string }> {
    try {
      this.logger.log(`정보 블로그 포스트 작업 시작: ${jobId}`)
      await this.jobLogsService.log(jobId, '정보 블로그 포스트 작업 시작')

      // 작업 정보 조회
      const infoBlogJob = await this.prisma.infoBlogJob.findUnique({
        where: { jobId },
        include: {
          bloggerAccount: true,
          wordpressAccount: true,
          tistoryAccount: true,
        },
      })

      assert(infoBlogJob, 'InfoBlogJob not found')

      // 계정 설정 확인 및 플랫폼 결정
      const { platform, accountId } = this.validateBlogAccount(infoBlogJob)

      // 플랫폼별 계정 사전 준비 (로그인/인증 상태 확인 및 처리)
      await this.jobLogsService.log(jobId, `${platform} 계정 사전 준비 시작`)
      await this.preparePlatformAccount(platform, accountId)
      await this.jobLogsService.log(jobId, `${platform} 계정 사전 준비 완료`)

      // 블로그 포스트 생성
      await this.jobLogsService.log(jobId, 'AI 블로그 내용 생성 시작')
      const infoBlogPost = await this.generateInfoBlogPost(infoBlogJob.title, infoBlogJob.content)
      await this.jobLogsService.log(jobId, 'AI 블로그 내용 생성 완료')

      // 썸네일 생성
      await this.jobLogsService.log(jobId, '썸네일 이미지 생성 시작')
      const localThumbnailUrl = await this.generateThumbnail(infoBlogPost.thumbnailText)
      await this.jobLogsService.log(jobId, '썸네일 이미지 생성 완료')

      const processedSections: ProcessedSection[] = await Promise.all(
        infoBlogPost.sections.map(async (section: SectionContent, sectionIndex: number) => {
          try {
            // 이미지 URL은 이미 업로드된 것을 사용

            // AI를 통해 이미지 생성
            const localGeneratedImagePath = await this.generateImage(section.html, sectionIndex, jobId)
            const [links, youtubeLinks, adHtml] = await Promise.all([
              this.generateLinks(section.html, sectionIndex, jobId, infoBlogPost.title),
              this.generateYoutubeLinks(section.html, sectionIndex, jobId),
              this.generateAdScript(sectionIndex),
            ])

            return {
              ...section,
              sectionIndex,
              imageUrl: localGeneratedImagePath,
              links,
              youtubeLinks,
              adHtml,
            }
          } catch (error) {
            await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 처리 중 오류: ${error.message}`, 'error')
            this.logger.error(`섹션 ${sectionIndex} 처리 중 오류:`, error)
            return {
              ...section,
              sectionIndex,
              imageUrl: undefined,
              imageUrlUploaded: undefined,
              links: [],
              youtubeLinks: [],
              adHtml: undefined,
            }
          }
        }),
      )

      // 이미지 업로드
      await this.jobLogsService.log(jobId, '이미지 등록 시작')
      // 1) 썸네일 업로드
      const uploadedThumbnail = (await this.uploadImages([localThumbnailUrl], platform, accountId))[0]

      // 2) 섹션 이미지 업로드: 로컬 경로가 존재하는 섹션만 업로드하고, 업로드 결과를 각 섹션에 매핑
      const sectionImageItems = processedSections
        .map((sec, idx) => ({ idx, path: sec.imageUrl }))
        .filter(item => !!item.path) as { idx: number; path: string }[]

      if (sectionImageItems.length > 0) {
        const uploadedSectionImages = await this.uploadImages(
          sectionImageItems.map(i => i.path),
          platform,
          accountId,
        )

        for (let i = 0; i < uploadedSectionImages.length; i++) {
          const sectionIndex = sectionImageItems[i].idx
          const uploaded = uploadedSectionImages[i]
          processedSections[sectionIndex].imageUrlUploaded = uploaded
          // 이후 HTML 조합에서 업로드된 자원을 사용하도록 교체
          processedSections[sectionIndex].imageUrl = uploaded

          if (infoBlogPost.sections[sectionIndex]) {
            infoBlogPost.sections[sectionIndex].imageUrl = uploaded
            infoBlogPost.sections[sectionIndex].links = processedSections[sectionIndex].links
            infoBlogPost.sections[sectionIndex].youtubeLinks = processedSections[sectionIndex].youtubeLinks
            infoBlogPost.sections[sectionIndex].adHtml = processedSections[sectionIndex].adHtml
          }
        }
      } else {
        // 이미지가 없는 섹션의 링크/유튜브/광고 정보만 반영
        for (const sec of processedSections) {
          const sIdx = sec.sectionIndex
          if (infoBlogPost.sections[sIdx]) {
            infoBlogPost.sections[sIdx].links = sec.links
            infoBlogPost.sections[sIdx].youtubeLinks = sec.youtubeLinks
            infoBlogPost.sections[sIdx].adHtml = sec.adHtml
          }
        }
      }
      await this.jobLogsService.log(jobId, '이미지 등록 완료')

      // 조합합수(생성된 이미지, 썸네일, 내용 등을 조합해서 html(string)로 만들기)
      await this.jobLogsService.log(jobId, 'HTML 콘텐츠 조합 시작')
      const contentHtml = this.combineHtmlSections({
        platform,
        infoBlogPost,
        thumbnailUrl: uploadedThumbnail,
      })
      await this.jobLogsService.log(jobId, 'HTML 콘텐츠 조합 완료')

      // 지정된 블로그로 발행 (AI가 생성한 제목 사용)
      await this.jobLogsService.log(jobId, `${platform} 블로그 발행 시작`)
      const publishResult = await this.publishToBlog({
        accountId,
        platform,
        title: infoBlogPost.title,
        localThumbnailUrl,
        thumbnailUrl: uploadedThumbnail,
        contentHtml,
        category: infoBlogJob.category,
        tags: infoBlogPost.tags,
      })
      const publishedUrl = publishResult.url
      await this.jobLogsService.log(jobId, `${platform} 블로그 발행 완료`)

      // 발행 완료 시 DB 업데이트
      await this.prisma.infoBlogJob.update({
        where: { jobId },
        data: {
          title: infoBlogPost.title,
          content: contentHtml,
          tags: infoBlogPost.tags,
          resultUrl: publishedUrl,
          status: InfoBlogPostJobStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      })

      this.logger.log(`정보 블로그 포스트 작업 완료: ${jobId}`)
      await this.jobLogsService.log(jobId, '정보 블로그 포스트 작업 완료')

      return {
        resultUrl: publishedUrl,
        resultMsg: '정보 리뷰 포스트가 성공적으로 발행되었습니다.',
      }
    } catch (error) {
      this.logger.error(`정보 블로그 포스트 작업 실패: ${jobId}`, error)
      throw error
    } finally {
      // 임시폴더 정리
      const tempDir = path.join(EnvConfig.tempDir)
      if (fs.existsSync(tempDir)) {
        try {
          // fs.rmSync를 사용하여 더 안전하게 폴더 삭제
          fs.rmSync(tempDir, { recursive: true, force: true })
          this.logger.log(`정보 이미지 임시 폴더 정리 완료: ${tempDir}`)
        } catch (error) {
          this.logger.warn(`정보 이미지 임시 폴더 정리 실패: ${tempDir}`, error)
        }
      }
    }
  }

  /**
   * 계정 설정 확인 및 플랫폼 결정
   */
  private validateBlogAccount(infoBlogJob: InfoBlogJob): {
    platform: 'tistory' | 'wordpress' | 'google_blog'
    accountId: number | string
  } {
    if (infoBlogJob.tistoryAccountId) {
      return {
        platform: 'tistory',
        accountId: infoBlogJob.tistoryAccountId,
      }
    } else if (infoBlogJob.wordpressAccountId) {
      return {
        platform: 'wordpress',
        accountId: infoBlogJob.wordpressAccountId,
      }
    } else if (infoBlogJob.bloggerAccountId) {
      return {
        platform: 'google_blog',
        accountId: infoBlogJob.bloggerAccountId,
      }
    } else {
      throw new CustomHttpException(ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED, {
        message: '블로그 계정이 설정되지 않았습니다. 티스토리, 워드프레스 또는 블로그스팟 계정을 먼저 설정해주세요.',
      })
    }
  }

  /**
   * 3. 이미지 업로드 (티스토리, 워드프레스, 구글 블로그)
   */
  private async uploadImages(
    imagePaths: string[],
    platform: 'tistory' | 'wordpress' | 'google_blog',
    accountId: number | string,
  ): Promise<string[]> {
    try {
      this.logger.log(`${platform} 이미지 업로드 시작: ${imagePaths.length}개`)

      assert(imagePaths.length > 0, '업로드할 이미지가 없습니다')

      let uploadedImages: string[] = []

      switch (platform) {
        case 'tistory':
          uploadedImages = await this.tistoryService.uploadImages(accountId as number, imagePaths)
          break
        case 'wordpress':
          // 워드프레스는 개별 업로드
          for (const imagePath of imagePaths) {
            try {
              const uploadedUrl = await this.wordpressService.uploadImage(accountId as number, imagePath)
              uploadedImages.push(uploadedUrl)
              this.logger.log(`이미지 업로드 완료: ${imagePath} → ${uploadedUrl}`)
            } catch (error) {
              this.logger.error(`이미지 업로드 실패 (${imagePath}):`, error)
              throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, {
                message: `${platform} 이미지 업로드에 실패했습니다. 이미지 URL: ${imagePath}`,
              })
            }
          }
          break
        case 'google_blog':
          // Google Blogger: GCS에 업로드 후 URL 사용
          uploadedImages = []
          for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i]
            try {
              const uploadedUrl = await this.uploadImageToGCS(imagePath, i)
              uploadedImages.push(uploadedUrl)
              this.logger.log(`GCS 이미지 업로드 완료: ${imagePath} → ${uploadedUrl}`)
            } catch (error) {
              this.logger.error(`GCS 이미지 업로드 실패 (${imagePath}):`, error)
              throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, {
                message: `${platform} 이미지 업로드에 실패했습니다. 이미지 URL: ${imagePath}`,
              })
            }
          }
          break
        default:
          assert(false, `지원하지 않는 플랫폼: ${platform}`)
      }

      this.logger.log(`${platform} 이미지 업로드 완료: ${uploadedImages.length}개`)
      return uploadedImages
    } catch (error) {
      this.logger.error(`${platform} 이미지 업로드 실패:`, error)
      throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, {
        message: `${platform} 이미지 업로드에 실패했습니다.`,
      })
    }
  }

  /**
   * GCS 업로드 헬퍼: 로컬/원격 이미지를 버퍼로 읽어 WebP 최적화 후 업로드
   */
  private async uploadImageToGCS(imageUrlOrPath: string, sectionIndex: number): Promise<string> {
    let imageBuffer: Buffer
    if (this.utilService.isLocalPath(imageUrlOrPath)) {
      const normalizedPath = path.normalize(imageUrlOrPath)
      imageBuffer = fs.readFileSync(normalizedPath)
    } else {
      const response = await axios.get(imageUrlOrPath, {
        responseType: 'arraybuffer',
        timeout: 30000,
      })
      imageBuffer = Buffer.from(response.data)
    }

    // 파일명/확장자/콘텐츠 타입 결정
    let originalName = ''
    let ext = ''
    if (this.utilService.isLocalPath(imageUrlOrPath)) {
      originalName = path.basename(path.normalize(imageUrlOrPath))
      ext = path.extname(originalName).toLowerCase()
    } else {
      try {
        const u = new URL(imageUrlOrPath)
        originalName = path.basename(u.pathname)
        ext = path.extname(originalName).toLowerCase()
      } catch {
        originalName = ''
        ext = ''
      }
    }

    const contentType = (() => {
      switch (ext) {
        case '.webp':
          return 'image/webp'
        case '.png':
          return 'image/png'
        case '.jpg':
        case '.jpeg':
          return 'image/jpeg'
        default:
          return 'image/webp'
      }
    })()

    const finalExt = ext || '.webp'
    const fileName =
      originalName && originalName.includes('.') ? originalName : `blog-image-${sectionIndex}-${Date.now()}${finalExt}`

    const uploadResult = await this.storageService.uploadImage(imageBuffer, {
      contentType,
      fileName,
    })
    return typeof (uploadResult as any) === 'string' ? (uploadResult as any) : uploadResult.url
  }

  /**
   * 썸네일 생성 (메인 이미지 + 위에 글자 생성)
   */
  private async generateThumbnail(thumbnailText: { lines: string[] }): Promise<string> {
    this.logger.log('썸네일 생성 시작')

    let browser: Browser | null = null
    let page: Page | null = null

    try {
      // 브라우저 시작
      browser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
        headless: EnvConfig.getPlaywrightHeadless(),
      })

      page = await browser.newPage()
      await page.setViewportSize({ width: 1000, height: 1000 })

      // HTML 페이지 생성
      const html = this.generateThumbnailHTML(thumbnailText)
      await page.setContent(html)

      // 스크린샷 촬영
      const screenshotPath = path.join(EnvConfig.tempDir, `thumbnail-${Date.now()}.png`)

      // temp 디렉토리가 없으면 생성
      const tempDir = path.dirname(screenshotPath)
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      assert(fs.existsSync(tempDir), '임시 디렉토리 생성에 실패했습니다')

      await page.screenshot({
        path: screenshotPath,
        type: 'png',
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
        },
      })

      this.logger.log(`썸네일 이미지 생성 완료: ${screenshotPath}`)
      return screenshotPath
    } catch (error) {
      this.logger.error('썸네일 이미지 생성 실패:', error)
      throw new CustomHttpException(ErrorCode.THUMBNAIL_GENERATION_FAILED, {
        message: `썸네일 이미지 생성 실패: ${error.message}`,
      })
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  /**
   * 썸네일 HTML 생성
   */
  private generateThumbnailHTML(thumbnailText: { lines: string[] }): string {
    const lines = thumbnailText.lines.map(line => line.trim()).filter(line => line.length > 0)

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link
      href="https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap"
      rel="stylesheet"
    />
    <style>
        body {
            margin: 0;
            padding: 40px;
            width: 1000px;
            height: 1000px;
            background: cornflowerblue;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'BMDOHYEON';
            position: relative;
                        
        }
        
        .backdrop {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.2);
            z-index: 1;
        }
        
        .thumbnail-container {
            background: #ffffff;
            border-radius: 10px;
            text-align: center;
            color: white;
            box-sizing: border-box;
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
        
        .text-line {
            font-size: 128px;
            font-weight: 900;
            line-height: 1.2;
            margin: 10px 0;
            letter-spacing: 3px;
            color: #000000;
            text-align: center;
            text-shadow:
              -2px -2px 0 #fff,
              2px -2px 0 #fff,
              -2px 2px 0 #fff,
              2px 2px 0 #fff,
              0px -2px 0 #fff,
              0px 2px 0 #fff,
              -2px 0px 0 #fff,
              2px 0px 0 #fff;
        }
    </style>
</head>
<body>
    <div class="thumbnail-container">
        ${lines.map(line => `<div class="text-line">${line}</div>`).join('')}
    </div>
</body>
</html>
    `
  }

  /**
   * 설정에 따라 이미지를 생성하는 함수
   */
  private async generateImage(html: string, sectionIndex: number, jobId?: string): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getSettings()
      const imageType = settings.imageType || 'none'

      let imageUrl: string | undefined

      switch (imageType) {
        case 'pixabay':
          try {
            await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} Pixabay 이미지 검색 시작`)
            const pixabayKeyword = await this.generatePixabayPrompt(html)
            const remoteImageUrl = await this.imagePixabayService.searchImage(pixabayKeyword)

            // 원격 이미지를 로컬 temp 디렉토리에 저장
            const response = await axios.get(remoteImageUrl, {
              responseType: 'arraybuffer',
              timeout: 30000,
            })
            const buffer = Buffer.from(response.data)

            if (!fs.existsSync(EnvConfig.tempDir)) {
              fs.mkdirSync(EnvConfig.tempDir, { recursive: true })
            }

            // URL에서 확장자 추출 (없으면 jpg)
            let ext = '.jpg'
            try {
              const u = new URL(remoteImageUrl)
              const name = u.pathname.split('/').pop() || ''
              const urlExt = name.includes('.') ? name.substring(name.lastIndexOf('.')) : ''
              if (urlExt) ext = urlExt
            } catch {}

            const fileName = `pixabay-${Date.now()}-${sectionIndex}${ext}`
            const localPath = path.join(EnvConfig.tempDir, fileName)
            fs.writeFileSync(localPath, buffer)

            imageUrl = localPath
            await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} Pixabay 이미지 로컬 저장 완료`)
          } catch (error) {
            await this.jobLogsService.log(
              jobId,
              `섹션 ${sectionIndex} Pixabay 이미지 처리 실패: ${error.message}`,
              'error',
            )
            return undefined
          }
          break
        case 'ai':
          try {
            await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} AI 이미지 생성 시작`)

            const imageGenerationLimiter = new Bottleneck({
              maxConcurrent: 3,
              minTime: 1000,
            })

            const aiImagePrompt = await this.generateAiImagePrompt(html)

            const generateWithRetry = async (retries = 6, initialDelay = 1000) => {
              let lastError: any = null

              for (let i = 0; i < retries; i++) {
                try {
                  return await imageGenerationLimiter.schedule(async () => {
                    this.logger.log(`Imagen 3로 이미지 생성: ${aiImagePrompt}`)
                    let tempFilePath: string | undefined

                    const gemini = await this.geminiService.getGemini()

                    // temp 디렉토리가 없으면 생성
                    if (!fs.existsSync(EnvConfig.tempDir)) {
                      fs.mkdirSync(EnvConfig.tempDir, { recursive: true })
                    }

                    const response = await gemini.models.generateImages({
                      model: 'imagen-3.0-generate-002',
                      prompt: aiImagePrompt,
                      config: {
                        numberOfImages: 1,
                      },
                    })

                    // 생성된 이미지가 있는지 확인
                    if (response?.generatedImages?.[0]?.image?.imageBytes) {
                      const buffer = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64')
                      const fileName = `output-${Date.now()}.png`
                      tempFilePath = path.join(EnvConfig.tempDir, fileName)
                      fs.writeFileSync(tempFilePath, buffer)

                      return tempFilePath // 로컬 파일 경로 반환
                    }

                    throw new CustomHttpException(ErrorCode.AI_IMAGE_DATA_NOT_FOUND)
                  })
                } catch (error) {
                  lastError = error
                  const isRateLimitError = error?.stack?.[0]?.status === 429 || error?.status === 429

                  if (i < retries - 1) {
                    const jitter = Math.random() * 0.3
                    const backoffDelay = Math.min(initialDelay * Math.pow(2, i) * (1 + jitter), 60000)

                    await this.jobLogsService.log(
                      jobId,
                      `섹션 ${sectionIndex} AI 이미지 생성 ${isRateLimitError ? 'rate limit으로 인해' : '오류로 인해'} ${Math.round(backoffDelay / 1000)}초 후 재시도... (${i + 1}/${retries})`,
                    )
                    await sleep(backoffDelay)
                    continue
                  }
                  throw lastError
                }
              }
              throw lastError || new CustomHttpException(ErrorCode.INTERNAL_ERROR, { message: '최대 재시도 횟수 초과' })
            }

            imageUrl = await generateWithRetry()

            await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} AI 이미지 생성 완료`)
          } catch (error) {
            await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} AI 이미지 생성 실패: ${error.message}`, 'error')
            return undefined
          }

          break
      }

      return imageUrl
    } catch (error) {
      this.logger.error(`섹션 ${sectionIndex} 이미지 생성 중 오류:`, error)
      return undefined
    }
  }

  private async uploadAllImages(
    localImagePaths: string[],
    localThumbnailUrl: string,
    platform: 'tistory' | 'wordpress' | 'google_blog',
    accountId: number | string,
  ): Promise<{ thumbnail: string; images: string[] }> {
    const [thumbnailUploads, images] = await Promise.all([
      this.uploadImages([localThumbnailUrl], platform, accountId),
      this.uploadImages(localImagePaths, platform, accountId),
    ])
    return { thumbnail: thumbnailUploads[0], images }
  }

  private combineHtmlSections({
    platform,
    infoBlogPost,
    thumbnailUrl,
  }: {
    platform: 'tistory' | 'wordpress' | 'google_blog'
    infoBlogPost: InfoBlogPost
    thumbnailUrl: string
  }): string {
    let html = ''

    // 썸네일 이미지 HTML
    const thumbnailHtml =
      platform === 'tistory'
        ? `
        <div class="thumbnail-container" style="text-align: center; margin-bottom: 20px;">
          ${thumbnailUrl}
        </div>
      `
        : `
        <div class="thumbnail-container" style="text-align: center; margin-bottom: 20px;">
          <img src="${thumbnailUrl}" alt="썸네일" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
        </div>
      `

    // 썸네일
    html += thumbnailHtml

    // 섹션들
    html += infoBlogPost.sections
      .map(section => {
        let sectionHtml = section.html
        // 광고 추가 (섹션 컨텐츠 바로 다음)
        if (section.adHtml) {
          sectionHtml += `\n${section.adHtml}`
        }
        // 관련 링크 추가
        if (section.links && section.links.length > 0) {
          section.links.forEach(linkResult => {
            sectionHtml += `\n<a href="${linkResult.link}" target="_blank" rel="noopener noreferrer" style="display: block; margin: 4px 0; color: #007bff; text-decoration: none; font-size: 14px; padding: 2px 0;">🔗 ${linkResult.name}</a>`
          })
        }

        // 이미지 추가
        if (section.imageUrl) {
          switch (platform) {
            case 'tistory':
              sectionHtml += `${section.imageUrl}`
              break
            case 'google_blog':
            case 'wordpress':
              sectionHtml += `\n<img src="${section.imageUrl}" alt="section image" style="width: 100%; height: auto; margin: 10px 0;" />`
              break
          }
        }
        // 유튜브 링크 임베딩 추가
        if (section.youtubeLinks && section.youtubeLinks.length > 0) {
          section.youtubeLinks.forEach(youtube => {
            sectionHtml += `
            <div class="youtube-embed" style="margin: 20px 0; text-align: center;">
                <iframe width="560" height="315" src="https://www.youtube.com/embed/${youtube.videoId}" 
                title="YouTube video player" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerpolicy="strict-origin-when-cross-origin" 
                allowfullscreen></iframe>
            </div>`
          })
        }
        // AI 이미지 프롬프트(디버깅용)
        if (section.aiImagePrompt) {
          sectionHtml += `\n<!-- AI 이미지 프롬프트: ${section.aiImagePrompt} -->`
        }
        return sectionHtml
      })
      .join('\n')
    return html
  }

  /**
   * 랜덤 인덱스 생성 (균등형 배치용)
   */
  private generateRandomIndices(count: number, max: number): number[] {
    if (count >= max) {
      // 이미지가 섹션보다 많거나 같으면 모든 섹션에 배치
      return Array.from({ length: max }, (_, i) => i)
    }

    // 랜덤하게 선택
    const indices: number[] = []
    const availableIndices = Array.from({ length: max }, (_, i) => i)

    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * availableIndices.length)
      indices.push(availableIndices[randomIndex])
      availableIndices.splice(randomIndex, 1)
    }

    return indices.sort((a, b) => a - b) // 순서대로 정렬
  }

  /**
   * 6. 지정된 블로그로 발행 (티스토리, 워드프레스)
   */
  private async publishToBlog(blogPostData: InfoBlogPostPublish): Promise<{ url: string }> {
    try {
      this.logger.log(`${blogPostData.platform} 블로그 발행 시작`)

      let publishedUrl: string

      switch (blogPostData.platform) {
        case 'tistory':
          // 티스토리: 계정의 기본 발행 상태 반영
          const tistoryAccount = (await this.prisma.tistoryAccount.findUnique({
            where: { id: blogPostData.accountId as number },
          })) as any
          const tistoryVisibility = tistoryAccount?.defaultVisibility === 'private' ? 'private' : 'public'
          const tistoryResult = await this.tistoryService.publishPost(blogPostData.accountId as number, {
            title: blogPostData.title,
            contentHtml: blogPostData.contentHtml,
            thumbnailPath: blogPostData.localThumbnailUrl,
            keywords: blogPostData.tags,
            category: blogPostData.category,
            postVisibility: tistoryVisibility,
          })
          publishedUrl = tistoryResult.url
          break
        case 'wordpress':
          // 워드프레스: 계정의 기본 발행 상태를 status에 반영
          const wpAccount = (await this.prisma.wordPressAccount.findUnique({
            where: { id: blogPostData.accountId as number },
          })) as any
          let wpStatus = 'publish'
          switch (wpAccount?.defaultVisibility) {
            case 'private':
              wpStatus = 'private'
              break
            case 'publish':
              wpStatus = 'publish'
              break
            case 'public':
            default:
              wpStatus = 'publish'
              break
          }
          // 태그 getOrCreate 처리
          const tagIds: number[] = []
          if (blogPostData.tags && blogPostData.tags.length > 0) {
            for (const tagName of blogPostData.tags) {
              try {
                const tagId = await this.wordpressService.getOrCreateTag(blogPostData.accountId as number, tagName)
                tagIds.push(tagId)
              } catch (error) {
                this.logger.warn(`태그 생성 실패 (${tagName}):`, error)
                // 태그 생성 실패해도 포스트 발행은 계속 진행
              }
            }
          }

          // 카테고리 getOrCreate 처리
          let categoryIds: number[] = []
          if (blogPostData.category) {
            try {
              const categoryId = await this.wordpressService.getOrCreateCategory(
                blogPostData.accountId as number,
                blogPostData.category,
              )
              categoryIds = [categoryId]
            } catch (error) {
              this.logger.warn(`카테고리 생성 실패 (${blogPostData.category}):`, error)
              // 카테고리 생성 실패해도 포스트 발행은 계속 진행
            }
          }

          // featuredMedia 처리 - thumbnailUrl이 이미 미디어 ID인지 URL인지 확인
          let featuredMediaId: number | undefined
          if (blogPostData.thumbnailUrl) {
            const mediaId = await this.wordpressService.getMediaIdByUrl(
              blogPostData.accountId as number,
              blogPostData.thumbnailUrl,
            )
            if (mediaId) {
              featuredMediaId = mediaId
            } else {
              this.logger.warn(`미디어 ID를 찾을 수 없습니다: ${blogPostData.thumbnailUrl}`)
            }
          }

          const wordpressResult = await this.wordpressService.publishPost(blogPostData.accountId as number, {
            title: blogPostData.title,
            content: blogPostData.contentHtml,
            status: wpStatus,
            tags: tagIds,
            categories: categoryIds,
            featuredMediaId,
          })
          publishedUrl = wordpressResult.url
          break
        case 'google_blog':
          // Google Blogger는 bloggerBlogId와 oauthId가 필요하므로 accountId를 bloggerAccountId로 사용
          const bloggerAccount = (await this.prisma.bloggerAccount.findUnique({
            where: { id: blogPostData.accountId as number },
          })) as any

          assert(bloggerAccount, `Blogger 계정을 찾을 수 없습니다: ${blogPostData.accountId}`)

          // 블로거: 계정의 기본 발행 상태가 private이면 draft로 발행
          const isDraft = bloggerAccount.defaultVisibility === 'private'
          const googleResult = await this.googleBloggerService.publish(
            {
              title: blogPostData.title,
              content: blogPostData.contentHtml,
              bloggerBlogId: bloggerAccount.bloggerBlogId,
              oauthId: bloggerAccount.googleOauthId,
            },
            { isDraft },
          )
          publishedUrl = googleResult.url
          break
        default:
          assert(false, `지원하지 않는 플랫폼: ${blogPostData.platform}`)
      }

      this.logger.log(`${blogPostData.platform} 블로그 발행 완료: ${publishedUrl}`)
      return { url: publishedUrl }
    } catch (error) {
      this.logger.error(`${blogPostData.platform} 블로그 발행 실패:`, error)
      throw new CustomHttpException(ErrorCode.JOB_CREATE_FAILED, {
        message: `${blogPostData.platform} 블로그 발행에 실패했습니다.`,
      })
    }
  }

  /**
   * 플랫폼별 계정 사전 준비 (로그인/인증 상태 확인 및 처리)
   */
  private async preparePlatformAccount(
    platform: 'tistory' | 'wordpress' | 'google_blog',
    accountId: number | string,
  ): Promise<void> {
    this.logger.log(`${platform} 계정 사전 준비 시작: ${accountId}`)

    switch (platform) {
      case 'tistory':
        await this.prepareTistoryAccount(accountId as number)
        break
    }

    this.logger.log(`${platform} 계정 사전 준비 완료: ${accountId}`)
  }

  /**
   * 티스토리 계정 준비 (로그인 상태 확인 및 처리)
   */
  private async prepareTistoryAccount(accountId: number): Promise<void> {
    // 티스토리 계정 정보 조회
    const tistoryAccount = await this.prisma.tistoryAccount.findUnique({
      where: { id: accountId },
    })

    if (!tistoryAccount) {
      throw new CustomHttpException(ErrorCode.DATA_NOT_FOUND, {
        message: `티스토리 계정을 찾을 수 없습니다: ${accountId}`,
      })
    }

    // 브라우저 세션을 통해 로그인 상태 확인 및 처리

    const { browser } = await this.tistoryAutomationService.initializeBrowserWithLogin(
      tistoryAccount.loginId,
      tistoryAccount.tistoryUrl,
    )
    await browser.close()
  }

  /*
   * ================================================================================================
   * 링크생성
   * =================================================================================================]
   */
  private async generateLinks(
    html: string,
    sectionIndex: number,
    jobId?: string,
    title?: string,
  ): Promise<LinkResult[]> {
    try {
      const settings = await this.settingsService.getSettings()
      if (!settings.linkEnabled) return []
      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 관련 링크 생성 시작`)

      // 1. Gemini로 검색어 추출 (섹션 제목도 함께 전달)
      const keyword = await this.generateLinkSearchPromptWithTitle(html, title)
      if (!keyword) return []

      // 2. searxng로 검색 (구글 엔진)
      const searchRes = await this.searxngService.search(`${keyword} -site:youtube.com -site:youtu.be`, 'google', 10)
      if (!searchRes.results.length) return []

      // 3. Gemini로 최적 링크 1개 선정
      const bestLink = await this.pickBestLinkByAI(html, searchRes.results)
      if (!bestLink) return []

      // AI로 링크 제목 가공
      const linkTitle = await this.generateLinkTitle(bestLink.title, bestLink.content)

      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 관련 링크 1개 선정 완료`)
      return [{ name: linkTitle, link: bestLink.url }]
    } catch (error) {
      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 링크 생성 실패: ${error.message}`, 'error')
      return []
    }
  }

  /*
   * ================================================================================================
   * 유튜브 링크 생성
   * =================================================================================================]
   */
  private async generateYoutubeLinks(html: string, sectionIndex: number, jobId?: string): Promise<YoutubeResult[]> {
    try {
      const settings = await this.settingsService.getSettings()
      if (!settings.youtubeEnabled) return []
      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 관련 유튜브 링크 생성 시작`)

      // 1. Gemini로 검색어 추출
      const keyword = await this.generateYoutubeSearchPrompt(html)
      if (!keyword) return []

      // 2. searxng로 검색 (유튜브 엔진)
      const searchRes = await this.searxngService.search(keyword, 'youtube', 10)
      if (!searchRes.results.length) return []

      // 3. Gemini로 최적 유튜브 링크 1개 선정
      const bestLink = await this.pickBestYoutubeByAI(html, searchRes.results)
      if (!bestLink) return []

      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 관련 유튜브 링크 1개 선정 완료`)
      return [{ title: bestLink.title, videoId: this.extractYoutubeId(bestLink.url), url: bestLink.url }]
    } catch (error) {
      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 유튜브 링크 생성 실패: ${error.message}`, 'error')
      return []
    }
  }

  // AI로 최적의 유튜브 링크 1개 선정 (구현 필요)
  private async pickBestYoutubeByAI(html: string, candidates: SearchResultItem[]): Promise<SearchResultItem | null> {
    if (!candidates.length) return null
    // Gemini 프롬프트 설계
    const prompt = `아래는 본문 HTML과, 본문과 관련된 유튜브 링크 후보 리스트입니다. 본문 내용에 가장 적합한 유튜브 동영상 1개를 골라주세요.\n\n[본문 HTML]\n${html}\n\n[유튜브 후보]\n${candidates
      .map((c, i) => `${i + 1}. ${c.title} - ${c.url}\n${c.content}`)
      .join('\n\n')}\n\n응답 형식:\n{\n  \"index\": 후보 번호 (1부터 시작)\n}`
    try {
      // Gemini 호출 (임시: generateYoutubeSearchPrompt 재활용, 실제로는 별도 함수로 분리 권장)
      const gemini = await this.geminiService.getGemini()
      const resp = await gemini.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: { index: { type: 'integer' } },
            required: ['index'],
          },
        },
      })
      const result = JSON.parse(resp.text)
      const idx = result.index - 1
      return candidates[idx] || candidates[0]
    } catch (e) {
      return candidates[0]
    }
  }

  // 유튜브 URL에서 videoId 추출
  private extractYoutubeId(url: string): string {
    const match = url.match(/[?&]v=([^&#]+)/) || url.match(/youtu\.be\/([^?&#]+)/)
    return match ? match[1] : ''
  }

  /*
   * ================================================================================================
   * Adsense 광고삽입
   * =================================================================================================]
   */
  private async generateAdScript(sectionIndex: number): Promise<string | undefined> {
    const settings = await this.settingsService.getSettings()
    const adEnabled = settings.adEnabled || false
    const adScript = settings.adScript

    // 첫 번째 섹션(sectionIndex = 0)에는 광고 삽입 안함
    if (sectionIndex === 0) {
      return undefined
    }

    if (!adEnabled || !adScript || adScript.trim() === '') {
      this.logger.log(`섹션 ${sectionIndex}: 광고 삽입 안함 (활성화: ${adEnabled}, 스크립트 존재: ${!!adScript})`)
      return undefined
    }
    this.logger.log(`섹션 ${sectionIndex}: 광고 스크립트 삽입 완료`)
    return `<div class="ad-section" style="margin: 20px 0; text-align: center;">\n${adScript}\n</div>`
  }

  /*
   * ================================================================================================
   * AI 생성
   * =================================================================================================]
   */

  async generateInfoBlogPost(title: string, desc: string): Promise<InfoBlogPost> {
    this.logger.log(`Gemini로 블로그 콘텐츠 생성 시작`)

    const prompt = `${postingContentsPrompt}
[제목]
${title}
[내용]
${desc}
}`

    const gemini = await this.geminiService.getGemini()

    const resp = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 60000,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: '해당글의 제목',
            },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  html: { type: Type.STRING },
                },
                required: ['html'],
              },
              minItems: 1,
            },
            thumbnailText: {
              type: Type.OBJECT,
              properties: {
                lines: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  minItems: 1,
                  maxItems: 3,
                },
              },
              description: '썸네일이미지용 텍스트, 줄당 최대 글자수는 6자, 최대 3줄, 제목',
              required: ['lines'],
            },
            tags: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: `태그추천 [검색 유입 최적화를 위한 키워드 추천]
생성 갯수: 10개
# 예시:
[가성비세제, 찬물세탁용]`,
            },
          },
          required: ['sections'],
          propertyOrdering: ['sections'],
        },
      },
    })

    return JSON.parse(resp.text) as InfoBlogPost
  }

  async generatePixabayPrompt(html: string): Promise<string[]> {
    const gemini = await this.geminiService.getGemini()
    const textContent = this.utilService.extractTextContent(html)
    const prompt = `다음 본문 텍스트를 분석하여 Pixabay 이미지에서 검색할 키워드 5개를 추천해주세요.\n콘텐츠의 주제와 내용을 잘 반영하는 키워드를 선택해주세요.\n키워드는 영어로 작성해주세요.\n\n[본문 텍스트]\n${textContent}\n\n응답 형식:\n{\n  \"keywords\": [\"keyword1\", \"keyword2\", \"keyword3\", \"keyword4\", \"keyword5\"]\n}`

    const resp = await gemini.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              minItems: 5,
              maxItems: 5,
            },
          },
          required: ['keywords'],
        },
      },
    })

    const result = JSON.parse(resp.text)
    return result.keywords
  }

  async generateAiImagePrompt(html: string): Promise<string> {
    const gemini = await this.geminiService.getGemini()
    const textContent = this.utilService.extractTextContent(html)
    const prompt = `다음 본문 텍스트를 분석하여 이미지 생성 AI에 입력할 프롬프트를 작성해주세요.\n콘텐츠의 주제와 내용을 잘 반영하는 이미지를 생성할 수 있도록 프롬프트를 작성해주세요.\n프롬프트는 영어로 작성해주세요.\n\n[본문 텍스트]\n${textContent}\n\n응답 형식:\n{\n  \"prompt\": \"프롬프트\"\n}`

    const resp = await gemini.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
          },
          required: ['prompt'],
        },
      },
    })

    const result = JSON.parse(resp.text)
    return result.prompt
  }

  /**
   * 본문에서 링크 검색용 검색어를 추출
   */
  async generateLinkSearchPrompt(html: string): Promise<string> {
    const gemini = await this.geminiService.getGemini()
    const textContent = this.utilService.extractTextContent(html)
    const prompt = `다음 본문 텍스트를 분석하여 구글 등에서 검색할 때 가장 적합한 한글 검색어 1개를 추천해주세요.\n\n[본문 텍스트]\n${textContent}\n\n응답 형식:\n{\n  \"keyword\": \"검색어\"\n}`
    const resp = await gemini.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keyword: { type: Type.STRING },
          },
          required: ['keyword'],
        },
      },
    })
    const result = JSON.parse(resp.text)
    return result.keyword
  }

  /**
   * 본문에서 유튜브 검색용 검색어를 추출
   */
  async generateYoutubeSearchPrompt(html: string): Promise<string> {
    const gemini = await this.geminiService.getGemini()
    const textContent = this.utilService.extractTextContent(html)
    const prompt = `다음 본문 텍스트를 분석하여 유튜브에서 검색할 때 가장 적합한 한글 검색어 1개를 추천해주세요.\n\n[본문 텍스트]\n${textContent}\n\n응답 형식:\n{\n  \"keyword\": \"검색어\"\n}`
    const resp = await gemini.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keyword: { type: Type.STRING },
          },
          required: ['keyword'],
        },
      },
    })
    const result = JSON.parse(resp.text)
    return result.keyword
  }

  async generateLinkTitle(title: string, content: string): Promise<string> {
    try {
      const gemini = await this.geminiService.getGemini()
      const prompt = `다음은 웹페이지의 원래 제목과 본문 내용 일부입니다. 이 정보를 참고하여 사용자가 보기 편하고, 핵심을 잘 전달하는 링크 제목을 30자 이내로 한글로 만들어주세요. 너무 길거나 불필요한 정보는 생략하고, 클릭을 유도할 수 있게 간결하게 요약/가공해주세요.\n\n[원래 제목]\n${title}\n\n[본문 내용]\n${content}\n\n응답 형식:\n{\n  \"linkTitle\": \"가공된 제목\"\n}`
      const resp = await gemini.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              linkTitle: { type: 'string' },
            },
            required: ['linkTitle'],
          },
        },
      })
      const result = JSON.parse(resp.text)
      return result.linkTitle
    } catch (error) {
      this.logger.error('링크 제목 가공 중 오류:', error)
      return title
    }
  }

  async pickBestLinkByAI(html: string, candidates: SearchResultItem[]): Promise<SearchResultItem | null> {
    if (!candidates.length) return null
    const textContent = this.utilService.extractTextContent(html)
    const prompt = `아래는 본문 텍스트와, 본문과 관련된 링크 후보 리스트입니다. 본문 내용에 가장 적합한 링크 1개를 골라주세요.\n\n[본문 텍스트]\n${textContent}\n\n[링크 후보]\n${candidates
      .map((c, i) => `${i + 1}. ${c.title} - ${c.url}\n${c.content}`)
      .join('\n\n')}\n\n응답 형식:\n{\n  \"index\": 후보 번호 (1부터 시작)\n}`
    try {
      const gemini = await this.geminiService.getGemini()
      const resp = await gemini.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: { index: { type: 'integer' } },
            required: ['index'],
          },
        },
      })
      const result = JSON.parse(resp.text)
      const idx = result.index - 1
      return candidates[idx] || candidates[0]
    } catch (e) {
      return candidates[0]
    }
  }

  async generateLinkSearchPromptWithTitle(html: string, title: string): Promise<string> {
    try {
      const gemini = await this.geminiService.getGemini()
      const textContent = this.utilService.extractTextContent(html)
      const prompt = `다음은 블로그 섹션의 제목과 본문 텍스트입니다. 이 두 정보를 모두 참고하여 구글 등에서 검색할 때 가장 적합한 한글 검색어 1개를 추천해주세요.\n\n[섹션 제목]\n${title}\n\n[본문 텍스트]\n${textContent}\n\n응답 형식:\n{\n  \"keyword\": \"검색어\"\n}`
      const resp = await gemini.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              keyword: { type: 'string' },
            },
            required: ['keyword'],
          },
        },
      })
      const result = JSON.parse(resp.text)
      return result.keyword
    } catch (error) {
      this.logger.error('링크 검색어(제목 포함) 생성 중 오류:', error)
      return ''
    }
  }

  /**
   * 엑셀 row 배열로부터 여러 개의 블로그 포스트 job을 생성
   */
  async createJobsFromExcelRows(rows: InfoBlogPostExcelRow[], immediateRequest: boolean = true): Promise<any[]> {
    const jobs: any[] = []

    // 플랫폼별 기본 계정 조회 (없으면 null 허용)
    const [defaultTistory, defaultWordpress, defaultBlogger] = await Promise.all([
      this.prisma.tistoryAccount.findFirst({ where: { isDefault: true } }),
      this.prisma.wordPressAccount.findFirst({ where: { isDefault: true } }),
      this.prisma.bloggerAccount.findFirst({ where: { isDefault: true } }),
    ])

    for (const row of rows) {
      const title = row.제목 || ''
      const content = row.내용 || ''
      const labels = row.라벨
        ? row.라벨
            .split(',')
            .map(label => label.trim())
            .filter(label => label)
        : []
      const scheduledAtFormatStr = row.예약날짜 || ''
      let scheduledAt: Date

      // 블로그 타입/계정 처리: (발행블로그유형 + 발행블로그이름)
      let bloggerAccountId: number | undefined
      let wordpressAccountId: number | undefined
      let tistoryAccountId: number | undefined

      // 카테고리 처리
      const category = row.카테고리 || undefined

      // 발행 상태(공개/비공개) 파싱은 기존 로직 유지

      if (row.발행블로그유형 && row.발행블로그이름) {
        const normalized = row.발행블로그유형.toLowerCase().trim()
        switch (normalized) {
          case 'wordpress':
          case '워드프레스': {
            const wordpress = await this.prisma.wordPressAccount.findFirst({ where: { name: row.발행블로그이름 } })
            assert(wordpress, `WordPress 계정을 찾을 수 없습니다: ${row.발행블로그이름}`)
            wordpressAccountId = wordpress.id
            break
          }
          case 'tistory':
          case '티스토리': {
            const tistory = await this.prisma.tistoryAccount.findFirst({ where: { name: row.발행블로그이름 } })
            assert(tistory, `Tistory 계정을 찾을 수 없습니다: ${row.발행블로그이름}`)
            tistoryAccountId = tistory.id
            break
          }
          case 'google_blog':
          case '구글':
          case '블로거':
          case '블로그스팟':
          case '구글블로그': {
            const blogger = await this.prisma.bloggerAccount.findFirst({ where: { name: row.발행블로그이름 } })
            assert(blogger, `Blogger 계정을 찾을 수 없습니다: ${row.발행블로그이름}`)
            bloggerAccountId = blogger.id
            break
          }
          default:
            assert(false, `지원하지 않는 블로그 타입입니다: ${row.발행블로그유형}`)
        }
      } else if (row.발행블로그유형 && !row.발행블로그이름) {
        // 발행 타입만 지정된 경우: 해당 타입의 기본 계정을 우선 적용
        const normalized = row.발행블로그유형.toLowerCase().trim()
        switch (normalized) {
          case 'tistory':
          case '티스토리': {
            if (defaultTistory) {
              tistoryAccountId = defaultTistory.id
              break
            }
            // 지정된 타입의 기본이 없으면 다른 기본으로 폴백
            if (defaultWordpress) {
              wordpressAccountId = defaultWordpress.id
              break
            }
            if (defaultBlogger) {
              bloggerAccountId = defaultBlogger.id
              break
            }
            throw new CustomHttpException(ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED, {
              message: '기본 블로그 계정이 설정되어 있지 않습니다. 기본 계정을 설정해주세요.',
            })
          }
          case 'wordpress':
          case '워드프레스': {
            if (defaultWordpress) {
              wordpressAccountId = defaultWordpress.id
              break
            }
            if (defaultTistory) {
              tistoryAccountId = defaultTistory.id
              break
            }
            if (defaultBlogger) {
              bloggerAccountId = defaultBlogger.id
              break
            }
            throw new CustomHttpException(ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED, {
              message: '기본 블로그 계정이 설정되어 있지 않습니다. 기본 계정을 설정해주세요.',
            })
          }
          case 'google_blog':
          case '구글':
          case '블로거':
          case '블로그스팟':
          case '구글블로그': {
            if (defaultBlogger) {
              bloggerAccountId = defaultBlogger.id
              break
            }
            if (defaultTistory) {
              tistoryAccountId = defaultTistory.id
              break
            }
            if (defaultWordpress) {
              wordpressAccountId = defaultWordpress.id
              break
            }
            throw new CustomHttpException(ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED, {
              message: '기본 블로그 계정이 설정되어 있지 않습니다. 기본 계정을 설정해주세요.',
            })
          }
          default: {
            // 타입 해석 불가 시, 어떤 기본이든 적용
            if (defaultTistory) {
              tistoryAccountId = defaultTistory.id
            } else if (defaultWordpress) {
              wordpressAccountId = defaultWordpress.id
            } else if (defaultBlogger) {
              bloggerAccountId = defaultBlogger.id
            } else {
              throw new CustomHttpException(ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED, {
                message: '기본 블로그 계정이 설정되어 있지 않습니다. 기본 계정을 설정해주세요.',
              })
            }
          }
        }
      } else {
        // 엑셀에 계정 정보가 없으면 기본 계정 자동 적용 (우선순위: 티스토리 > 워드프레스 > 블로거)
        if (defaultTistory) {
          tistoryAccountId = defaultTistory.id
        } else if (defaultWordpress) {
          wordpressAccountId = defaultWordpress.id
        } else if (defaultBlogger) {
          bloggerAccountId = defaultBlogger.id
        } else {
          // 기본 계정이 전혀 없는 경우만 에러 처리
          throw new CustomHttpException(ErrorCode.BLOG_ACCOUNT_NOT_CONFIGURED, {
            message:
              '기본 블로그 계정이 설정되어 있지 않습니다. 티스토리, 워드프레스 또는 블로그스팟 중 하나의 기본 계정을 설정해주세요.',
          })
        }
      }

      if (scheduledAtFormatStr && typeof scheduledAtFormatStr === 'string' && scheduledAtFormatStr.trim() !== '') {
        try {
          // 날짜 문자열에서 불필요한 공백 제거
          const cleanDateStr = scheduledAtFormatStr.trim()

          // date-fns의 parse 함수를 사용하여 날짜 파싱
          const parsed = parse(cleanDateStr, 'yyyy-MM-dd HH:mm', new Date())

          if (isValid(parsed)) {
            scheduledAt = parsed
            this.logger.log(`날짜 파싱 성공: ${cleanDateStr} → ${parsed.toISOString()}`)
          } else {
            this.logger.warn(`유효하지 않은 날짜 형식: ${cleanDateStr}, 현재 시간으로 설정됩니다.`)
            scheduledAt = new Date()
          }
        } catch (error) {
          this.logger.error(`날짜 파싱 오류: ${scheduledAtFormatStr}, ${error.message}`)
          scheduledAt = new Date()
        }
      } else {
        this.logger.warn('예약날짜가 비어있어 현재 시간으로 설정됩니다.')
        scheduledAt = new Date()
      }

      const job = await this.prisma.job.create({
        data: {
          subject: `${title} 제목 포스팅 등록`,
          desc: `${content}`,
          targetType: JobTargetType.BLOG_INFO_POSTING,
          status: immediateRequest ? JobStatus.REQUEST : JobStatus.PENDING,
          priority: 1,
          scheduledAt,
        },
      })

      await this.prisma.infoBlogJob.create({
        data: {
          jobId: job.id,
          title,
          content,
          labels: labels.length > 0 ? (labels as any) : null,
          category: category || null,
          bloggerAccountId,
          wordpressAccountId,
          tistoryAccountId,
          publishVisibility: (() => {
            const raw = (row.상태 || row.등록상태 || '').trim()
            switch (raw) {
              case '비공개':
                return 'private'
              case '':
              default:
                return 'public'
            }
          })(),
        },
      })

      const accountLog = (() => {
        if (tistoryAccountId) return `TistoryAccountId: ${tistoryAccountId}`
        if (wordpressAccountId) return `WordPressAccountId: ${wordpressAccountId}`
        if (bloggerAccountId) return `BloggerAccountId: ${bloggerAccountId}`
        return 'Account: default applied'
      })()
      await this.jobLogsService.log(job.id, `작업이 등록되었습니다. (${accountLog})`, 'info')
      jobs.push(job)
    }
    return jobs
  }
}
