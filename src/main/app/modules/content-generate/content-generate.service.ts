import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ImagePixabayService } from '../media/image-pixabay.service'
import { SettingsService } from '../settings/settings.service'
import axios from 'axios'
import sharp from 'sharp'
import { StorageService } from '@main/app/modules/google/storage/storage.service'
import Bottleneck from 'bottleneck'
import { sleep } from '@main/app/utils/sleep'
import { AIService, BlogPost, LinkResult, YoutubeResult } from '@main/app/modules/ai/ai.interface'
import { AIFactory } from '@main/app/modules/ai/ai.factory'
import * as fs from 'fs'
import * as path from 'path'
import { EnvConfig } from '@main/config/env.config'
import { UtilService } from '../util/util.service'
import { SearxngService, SearchResultItem } from '../search/searxng.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { TistoryService } from '../tistory/tistory.service'
import { JobLogsService } from '../job/job-logs/job-logs.service'

export interface SectionContent {
  html: string
  imageUrl?: string
  adHtml?: string
  links?: LinkResult[]
  youtubeLinks?: YoutubeResult[]
}

export interface ProcessedSection extends SectionContent {
  sectionIndex: number
  imageUrlUploaded?: string
}

@Injectable()
export class ContentGenerateService implements OnModuleInit {
  private readonly logger = new Logger(ContentGenerateService.name)
  private imageGenerationLimiter: Bottleneck

  constructor(
    private readonly aiFactory: AIFactory,
    private readonly imagePixabayService: ImagePixabayService,
    private readonly storageService: StorageService,
    private readonly settingsService: SettingsService,
    private readonly jobLogsService: JobLogsService,
    private readonly utilService: UtilService,
    private readonly searxngService: SearxngService,
    private readonly tistoryService: TistoryService,
  ) {
    this.imageGenerationLimiter = new Bottleneck({
      maxConcurrent: 3,
      minTime: 1000,
    })
  }

  async onModuleInit() {}

  private async getAIService(): Promise<AIService> {
    const aiService = await this.aiFactory.getAIService()
    await aiService.initialize()
    return aiService
  }

  /**
   * 이미지 URL들을 수집하는 메서드
   */
  private collectImageUrls(sections: SectionContent[]): { url: string; sectionIndex: number }[] {
    return sections.map((section, index) => ({ url: section.imageUrl, sectionIndex: index })).filter(item => item.url) // 이미지가 있는 섹션만 필터링
  }

  /**
   * 병렬로 이미지들을 업로드하는 메서드
   */
  private async uploadImagesInParallel(
    imageUrls: { url: string; sectionIndex: number }[],
    jobId?: string,
  ): Promise<Map<number, string>> {
    const settings = await this.settingsService.getSettings()
    const uploadPromises = imageUrls.map(async ({ url, sectionIndex }) => {
      try {
        let uploadStrategy: 'tistory' | 'gcs'
        switch (settings.publishType) {
          case 'tistory':
            uploadStrategy = 'tistory'
            break
          case 'google':
          default:
            uploadStrategy = 'gcs'
            break
        }
        const uploadedUrl = await this.uploadImage(url, sectionIndex, jobId, uploadStrategy)
        return { sectionIndex, uploadedUrl: uploadedUrl || '' }
      } catch (error) {
        this.logger.error(`섹션 ${sectionIndex} 이미지 업로드 실패:`, error)
        await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 이미지 업로드 실패: ${error.message}`, 'error')
        return { sectionIndex, uploadedUrl: '' }
      }
    })

    const results = await Promise.all(uploadPromises)

    // 결과를 Map으로 변환
    const uploadedUrls = new Map<number, string>()
    results.forEach(({ sectionIndex, uploadedUrl }) => {
      if (uploadedUrl) {
        uploadedUrls.set(sectionIndex, uploadedUrl)
      }
    })

    return uploadedUrls
  }

  async generate(title: string, desc: string, jobId?: string): Promise<string> {
    await this.jobLogsService.log(jobId, '블로그 포스트 생성 시작')

    // 1. AI 서비스 초기화
    const aiService = await this.getAIService()

    // 1. 블로그 아웃라인 생성
    await this.jobLogsService.log(jobId, '블로그 목차 생성 시작')
    const blogOutline = await aiService.generateBlogOutline(title, desc)
    await this.jobLogsService.log(jobId, '블로그 목차 생성 완료')

    // 2. 블로그 포스트 생성
    await this.jobLogsService.log(jobId, '블로그 포스트 생성 시작')
    const blogPost = await aiService.generateBlogPost(blogOutline)
    await this.jobLogsService.log(jobId, '블로그 포스트 생성 완료')

    // 3. 설정 가져오기
    const settings = await this.settingsService.getSettings()

    // 4. 이미지 생성 및 업로드
    await this.jobLogsService.log(jobId, '이미지 생성 및 업로드 시작')

    // 4-1. 각 섹션에 대해 이미지 생성
    const sectionsWithImages = await Promise.all(
      blogPost.sections.map(async (section: SectionContent, sectionIndex: number) => {
        try {
          // AI를 통해 이미지 생성
          const imageUrl = await this.generateImage(section.html, sectionIndex, jobId, aiService)
          return {
            ...section,
            imageUrl,
          }
        } catch (error) {
          this.logger.error(`섹션 ${sectionIndex} 이미지 생성 실패:`, error)
          await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 이미지 생성 실패: ${error.message}`, 'error')
          return {
            ...section,
            imageUrl: undefined,
          }
        }
      }),
    )

    // 4-2. 생성된 이미지들을 병렬로 업로드
    let uploadedUrls = new Map<number, string>()
    const imageUrls = this.collectImageUrls(sectionsWithImages)
    if (imageUrls.length > 0) {
      await this.jobLogsService.log(jobId, '이미지 병렬 업로드 시작')
      uploadedUrls = await this.uploadImagesInParallel(imageUrls, jobId)
      await this.jobLogsService.log(jobId, '이미지 병렬 업로드 완료')
    }
    await this.jobLogsService.log(jobId, '이미지 생성 및 업로드 완료')

    // 5. 섹션별 처리 (이미지 업로드 제외)
    await this.jobLogsService.log(jobId, '섹션별 추가 컨텐츠 처리 시작')

    const processedSections: ProcessedSection[] = await Promise.all(
      sectionsWithImages.map(async (section: SectionContent, sectionIndex: number) => {
        try {
          // 이미지 URL은 이미 업로드된 것을 사용
          const uploadedImageUrl = uploadedUrls.get(sectionIndex)

          const [links, youtubeLinks, adHtml] = await Promise.all([
            this.generateLinks(section.html, sectionIndex, jobId, title),
            this.generateYoutubeLinks(section.html, sectionIndex, jobId),
            this.generateAdScript(sectionIndex),
          ])

          return {
            ...section,
            sectionIndex,
            imageUrl: uploadedImageUrl,
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

    // 6. HTML 조합
    await this.jobLogsService.log(jobId, 'HTML 조합 시작')
    const combinedHtml = this.combineHtmlSections(settings.publishType, {
      ...blogPost,
      sections: processedSections,
    })
    await this.jobLogsService.log(jobId, 'HTML 조합 완료')

    return combinedHtml
  }

  /**
   * 링크 생성을 처리하는 메서드
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
      const aiService = await this.getAIService()
      const keyword = await aiService.generateLinkSearchPromptWithTitle(html, title)
      if (!keyword) return []

      // 2. searxng로 검색 (구글 엔진)
      const searchRes = await this.searxngService.search(`${keyword} -site:youtube.com -site:youtu.be`, 'google', 10)
      if (!searchRes.results.length) return []

      // 3. Gemini로 최적 링크 1개 선정
      const bestLink = await aiService.pickBestLinkByAI(html, searchRes.results)
      if (!bestLink) return []

      // AI로 링크 제목 가공
      const linkTitle = await aiService.generateLinkTitle(bestLink.title, bestLink.content)

      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 관련 링크 1개 선정 완료`)
      return [{ name: linkTitle, link: bestLink.url }]
    } catch (error) {
      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 링크 생성 실패: ${error.message}`, 'error')
      return []
    }
  }

  /**
   * 유튜브 링크 생성을 처리하는 메서드
   */
  private async generateYoutubeLinks(html: string, sectionIndex: number, jobId?: string): Promise<YoutubeResult[]> {
    try {
      const settings = await this.settingsService.getSettings()
      if (!settings.youtubeEnabled) return []
      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 관련 유튜브 링크 생성 시작`)

      // 1. Gemini로 검색어 추출
      const aiService = await this.getAIService()
      const keyword = await aiService.generateYoutubeSearchPrompt(html)
      if (!keyword) return []

      // 2. searxng로 검색 (유튜브 엔진)
      const searchRes = await this.searxngService.search(keyword, 'youtube', 10)
      if (!searchRes.results.length) return []

      // 3. Gemini로 최적 유튜브 링크 1개 선정
      const bestLink = await this.pickBestYoutubeByAI(html, searchRes.results, aiService)
      if (!bestLink) return []

      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 관련 유튜브 링크 1개 선정 완료`)
      return [{ title: bestLink.title, videoId: this.extractYoutubeId(bestLink.url), url: bestLink.url }]
    } catch (error) {
      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 유튜브 링크 생성 실패: ${error.message}`, 'error')
      return []
    }
  }

  // AI로 최적의 유튜브 링크 1개 선정 (구현 필요)
  private async pickBestYoutubeByAI(
    html: string,
    candidates: SearchResultItem[],
    aiService: AIService,
  ): Promise<SearchResultItem | null> {
    if (!candidates.length) return null
    // Gemini 프롬프트 설계
    const prompt = `아래는 본문 HTML과, 본문과 관련된 유튜브 링크 후보 리스트입니다. 본문 내용에 가장 적합한 유튜브 동영상 1개를 골라주세요.\n\n[본문 HTML]\n${html}\n\n[유튜브 후보]\n${candidates
      .map((c, i) => `${i + 1}. ${c.title} - ${c.url}\n${c.content}`)
      .join('\n\n')}\n\n응답 형식:\n{\n  \"index\": 후보 번호 (1부터 시작)\n}`
    try {
      // Gemini 호출 (임시: generateYoutubeSearchPrompt 재활용, 실제로는 별도 함수로 분리 권장)
      const ai = aiService as any
      const resp = await ai.getGemini().then((gemini: any) =>
        gemini.models.generateContent({
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
        }),
      )
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

  /**
   * SEO 정보를 생성하는 메서드
   */
  private async generateSeo(html: string, sectionIndex: number): Promise<string> {
    try {
      return ''
    } catch (error) {
      this.logger.warn(`섹션 ${sectionIndex} SEO 처리 중 오류: ${error.message}`)
      return ''
    }
  }

  /**
   * 썸네일 이미지를 생성하는 함수
   */
  async generateThumbnailImage(title: string, subtitle?: string): Promise<string | undefined> {
    return undefined
  }

  /**
   * 이미지를 WebP 형식으로 변환하고 최적화하는 함수
   */
  private async optimizeImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(imageBuffer).webp({ quality: 80 }).toBuffer()
    } catch (error) {
      this.logger.error('이미지 최적화 중 오류:', error)
      return imageBuffer
    }
  }

  /**
   * 설정에 따라 이미지를 생성하는 함수
   */
  private async generateImage(
    html: string,
    sectionIndex: number,
    jobId?: string,
    aiService?: AIService,
  ): Promise<string | undefined> {
    try {
      const settings = await this.settingsService.getSettings()
      const imageType = settings.imageType || 'none'
      const currentAiService = aiService || (await this.getAIService())

      let imageUrl: string | undefined

      if (imageType === 'pixabay') {
        try {
          await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} Pixabay 이미지 검색 시작`)
          const pixabayKeyword = await currentAiService.generatePixabayPrompt(html)
          imageUrl = await this.imagePixabayService.searchImage(pixabayKeyword)
          await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} Pixabay 이미지 검색 완료`)
        } catch (error) {
          await this.jobLogsService.log(
            jobId,
            `섹션 ${sectionIndex} Pixabay 이미지 검색 실패: ${error.message}`,
            'error',
          )
          return undefined
        }
      } else if (imageType === 'ai') {
        try {
          await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} AI 이미지 생성 시작`)

          const aiImagePrompt = await currentAiService.generateAiImagePrompt(html)

          const generateWithRetry = async (retries = 6, initialDelay = 1000) => {
            let lastError: any = null

            for (let i = 0; i < retries; i++) {
              try {
                return await this.imageGenerationLimiter.schedule(async () => {
                  const result = await currentAiService.generateImage(aiImagePrompt)
                  return result
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
      }

      return imageUrl
    } catch (error) {
      this.logger.error(`섹션 ${sectionIndex} 이미지 생성 중 오류:`, error)
      return undefined
    }
  }

  /**
   * 이미지를 업로드하는 함수
   */
  public async uploadImage(
    imageUrl: string,
    sectionIndex: number,
    jobId: string | undefined,
    uploadStrategy: 'gcs' | 'tistory',
  ): Promise<string | undefined> {
    if (!imageUrl) return undefined

    let tempPath: string | undefined

    try {
      if (uploadStrategy === 'gcs') {
        // GCS 업로드 로직
        let imageBuffer: Buffer
        // 로컬 파일 경로인 경우
        if (this.utilService.isLocalPath(imageUrl)) {
          const normalizedPath = path.normalize(imageUrl)
          imageBuffer = fs.readFileSync(normalizedPath)
        } else {
          // 원격 URL인 경우
          const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          })
          imageBuffer = Buffer.from(response.data)
        }

        const optimizedBuffer = await this.optimizeImage(imageBuffer)
        const fileName = `blog-image-${sectionIndex}-${Date.now()}.webp`
        const uploadResult = await this.storageService.uploadImage(optimizedBuffer, {
          contentType: 'image/webp',
          fileName,
        })
        const uploadedUrl = typeof uploadResult === 'string' ? uploadResult : uploadResult.url
        await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} GCS 이미지 업로드 완료`)
        return uploadedUrl
      } else if (uploadStrategy === 'tistory') {
        // 티스토리 업로드 로직 - tistoryService에서 브라우저 세션 관리
        let imageBuffer: Buffer
        // 로컬 파일 경로인 경우
        if (this.utilService.isLocalPath(imageUrl)) {
          const normalizedPath = path.normalize(imageUrl)
          imageBuffer = fs.readFileSync(normalizedPath)
        } else {
          // 원격 URL인 경우
          const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          })
          imageBuffer = Buffer.from(response.data)
        }

        tempPath = path.join(EnvConfig.tempDir, `temp-image-${sectionIndex}-${Date.now()}.jpg`)
        fs.writeFileSync(tempPath, imageBuffer)

        // TODO 고치기
        // const uploadedUrl = await this.tistoryService.uploadImage(tempPath)
        const uploadedUrl = null

        await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 티스토리 이미지 업로드 완료`)
        return uploadedUrl
      }
    } catch (error) {
      await this.jobLogsService.log(jobId, `섹션 ${sectionIndex} 이미지 업로드 실패: ${error.message}`, 'error')
      this.logger.error(`섹션 ${sectionIndex} 이미지 업로드 중 오류:`, error)
    }

    return undefined
  }

  /**
   * 설정에 따라 이미지를 생성하는 함수 (기존 메서드 유지)
   */
  private async generateAndUploadImage(
    html: string,
    sectionIndex: number,
    jobId?: string,
    aiService?: AIService,
  ): Promise<string | undefined> {
    const imageUrl = await this.generateImage(html, sectionIndex, jobId, aiService)
    if (imageUrl) {
      const settings = await this.settingsService.getSettings()
      let uploadStrategy: 'tistory' | 'gcs'
      switch (settings.publishType) {
        case 'tistory':
          uploadStrategy = 'tistory'
          break
        case 'google':
        default:
          uploadStrategy = 'gcs'
          break
      }
      return await this.uploadImage(imageUrl, sectionIndex, jobId, uploadStrategy)
    }
    return undefined
  }

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

  /**
   * Combine HTML sections into a single HTML string
   * BlogPost에 thumbnailUrl, seo 등 메타 정보도 포함
   */
  private combineHtmlSections(blogType: 'tistory' | 'google', blogPostHtml: BlogPost): string {
    let html = ''
    // 썸네일
    if (blogPostHtml.thumbnailUrl) {
      html += `<img src="${blogPostHtml.thumbnailUrl}" alt="thumbnail" style="width: 100%; height: auto; margin-bottom: 20px;" />\n`
    }
    // SEO (jsonLd)
    if (blogPostHtml.seo) {
      html += `<script type="application/ld+json">${blogPostHtml.seo}</script>\n`
    }
    // 섹션들
    html += blogPostHtml.sections
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
          switch (blogType) {
            case 'tistory':
              sectionHtml += `${section.imageUrl}`
              break
            case 'google':
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
}
