// import { Injectable, Logger } from '@nestjs/common'
// import { chromium } from 'playwright'
// import { OpenAiService } from '../ai/openai.service'
// import { BrowserWindow } from 'electron'
// import * as path from 'path'
// import * as fs from 'fs'
// // Canvas 기반 썸네일 생성을 위한 import (설치 후 활성화)
// // import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas'
//
// export interface ThumbnailOptions {
//   title: string
//   subtitle?: string
//   backgroundColor?: string
//   backgroundImagePath?: string
//   textColor?: string
//   fontSize?: number
//   width?: number
//   height?: number
//   fontFamily?: string
// }
//
// interface ThumbnailLayoutElement {
//   id: string
//   text: string
//   x: number
//   y: number
//   width: number
//   height: number
//   fontSize: number
//   fontFamily: string
//   color: string
//   textAlign: 'left' | 'center' | 'right'
//   fontWeight: 'normal' | 'bold'
//   opacity: number
//   rotation: number
//   zIndex: number
// }
//
// interface ThumbnailLayoutData {
//   id: string
//   backgroundImage: string
//   elements: ThumbnailLayoutElement[]
//   createdAt: string
//   updatedAt: string
// }
//
// interface TemplateVariables {
//   [key: string]: string
// }
//
// @Injectable()
// export class ThumbnailGeneratorService {
//   private readonly logger = new Logger(ThumbnailGeneratorService.name)
//
//   constructor(private readonly openAiService: OpenAiService) {}
//
//   async generateThumbnail(options: ThumbnailOptions): Promise<Buffer> {
//     const {
//       title,
//       subtitle = '',
//       backgroundImagePath,
//       textColor = '#ffffff',
//       fontSize = 48,
//       fontFamily = 'BMDOHYEON',
//     } = options
//
//     // 사이즈를 1000x1000으로 고정
//     const width = 1000
//     const height = 1000
//
//     const browser = await chromium.launch({
//       headless: true,
//       executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
//       args: ['--no-sandbox', '--disable-setuid-sandbox'],
//     })
//
//     try {
//       const page = await browser.newPage()
//       await page.setViewportSize({ width, height })
//
//       const html = this.generateThumbnailHTML({
//         title,
//         subtitle,
//         backgroundImagePath,
//         textColor,
//         fontSize,
//         fontFamily,
//         width,
//         height,
//       })
//
//       await page.setContent(html)
//
//       const screenshot = await page.screenshot({
//         type: 'png',
//         clip: {
//           x: 0,
//           y: 0,
//           width,
//           height,
//         },
//       })
//
//       return screenshot
//     } catch (error) {
//       this.logger.error('썸네일 생성 중 오류 발생:', error)
//       throw new Error(`썸네일 생성 실패: ${error.message}`)
//     } finally {
//       await browser.close()
//     }
//   }
//
//   private generateThumbnailHTML(options: ThumbnailOptions & { width: number; height: number }): string {
//     const { title, subtitle, backgroundImagePath, textColor, fontSize, fontFamily, width, height } = options
//
//     // 배경 스타일 결정 - 배경색은 제거하고 배경이미지만 사용
//     let backgroundStyle = 'background: #4285f4;' // 기본 배경색 (이미지가 없을 때만)
//
//     if (backgroundImagePath && fs.existsSync(backgroundImagePath)) {
//       // 배경이미지가 있는 경우
//       const backgroundImageBase64 = this.convertImageToBase64(backgroundImagePath)
//       backgroundStyle = `
//         background-image: url('data:image/png;base64,${backgroundImageBase64}');
//         background-size: cover;
//         background-position: center;
//         background-repeat: no-repeat;
//       `
//     }
//
//     return `
// <!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//
//     <!-- 한국 폰트 임포트 -->
//     <link rel="preconnect" href="https://fonts.googleapis.com">
//     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
//     <style>
//         @import url('http://fonts.googleapis.com/earlyaccess/nanumgothic.css');
//         @import url('https://cdn.rawgit.com/moonspam/NanumSquare/master/nanumsquare.css');
//
//         @font-face {
//             font-family: 'BMDOHYEON';
//             src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMDOHYEON.woff') format('woff');
//             font-weight: normal;
//             font-style: normal;
//         }
//
//         * {
//             margin: 0;
//             padding: 0;
//             box-sizing: border-box;
//         }
//
//         body {
//             width: ${width}px;
//             height: ${height}px;
//             ${backgroundStyle}
//             display: flex;
//             flex-direction: column;
//             justify-content: center;
//             align-items: center;
//             font-family: ${fontFamily}, 'Nanum Gothic', 'NanumSquare', sans-serif;
//             overflow: hidden;
//             position: relative;
//         }
//
//         .overlay {
//             position: absolute;
//             top: 0;
//             left: 0;
//             right: 0;
//             bottom: 0;
//             background: rgba(0, 0, 0, 0.4);
//             z-index: 1;
//         }
//
//         .container {
//             text-align: center;
//             padding: 60px;
//             max-width: 90%;
//             position: relative;
//             z-index: 2;
//         }
//
//         .title {
//             color: ${textColor};
//             font-size: ${fontSize}px;
//             font-weight: bold;
//             line-height: 1.2;
//             margin-bottom: ${subtitle ? '20px' : '0'};
//             word-wrap: break-word;
//             text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
//         }
//
//         .subtitle {
//             color: ${textColor};
//             font-size: ${fontSize * 0.6}px;
//             font-weight: 400;
//             line-height: 1.4;
//             opacity: 0.9;
//             word-wrap: break-word;
//             text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
//         }
//     </style>
// </head>
// <body>
//     ${backgroundImagePath && fs.existsSync(backgroundImagePath) ? '<div class="overlay"></div>' : ''}
//     <div class="container">
//         <div class="title">${this.escapeHtml(title)}</div>
//         ${subtitle ? `<div class="subtitle">${this.escapeHtml(subtitle)}</div>` : ''}
//     </div>
// </body>
// </html>
//     `
//   }
//
//   private convertImageToBase64(imagePath: string): string {
//     try {
//       const imageBuffer = fs.readFileSync(imagePath)
//       return imageBuffer.toString('base64')
//     } catch (error) {
//       this.logger.error(`배경이미지 읽기 실패: ${imagePath}`, error)
//       throw new Error(`배경이미지 읽기 실패: ${error.message}`)
//     }
//   }
//
//   private escapeHtml(text: string): string {
//     return text
//       .replace(/&/g, '&amp;')
//       .replace(/</g, '&lt;')
//       .replace(/>/g, '&gt;')
//       .replace(/"/g, '&quot;')
//       .replace(/'/g, '&#039;')
//   }
//
//   /**
//    * 배경이미지 저장 경로 반환
//    * @param fileName 파일명
//    * @returns 저장 경로
//    */
//   getBackgroundImagePath(fileName: string): string {
//     const isDev = process.env.NODE_ENV !== 'production'
//
//     if (isDev) {
//       // 개발 환경: pwd/static/thumbnail/backgrounds/
//       return path.join(process.cwd(), 'static', 'thumbnail', 'backgrounds', fileName)
//     } else {
//       // 프로덕션 환경: app.getPath('userData')/backgrounds/
//       const { app } = require('electron')
//       const userDataPath = app.getPath('userData')
//       const backgroundsDir = path.join(userDataPath, 'backgrounds')
//
//       // 디렉토리가 없으면 생성
//       if (!fs.existsSync(backgroundsDir)) {
//         fs.mkdirSync(backgroundsDir, { recursive: true })
//       }
//
//       return path.join(backgroundsDir, fileName)
//     }
//   }
//
//   /**
//    * 배경이미지 저장
//    * @param imageBuffer 이미지 버퍼
//    * @param fileName 파일명
//    * @returns 저장된 파일 경로
//    */
//   async saveBackgroundImage(imageBuffer: Buffer, fileName: string): Promise<string> {
//     const savePath = this.getBackgroundImagePath(fileName)
//
//     try {
//       // 디렉토리 생성 (존재하지 않는 경우)
//       const dir = path.dirname(savePath)
//       if (!fs.existsSync(dir)) {
//         fs.mkdirSync(dir, { recursive: true })
//       }
//
//       fs.writeFileSync(savePath, imageBuffer)
//       this.logger.log(`배경이미지 저장 완료: ${savePath}`)
//       return savePath
//     } catch (error) {
//       this.logger.error(`배경이미지 저장 실패: ${savePath}`, error)
//       throw new Error(`배경이미지 저장 실패: ${error.message}`)
//     }
//   }
//
//   /**
//    * 저장된 배경이미지 목록 반환
//    * @returns 배경이미지 파일명 배열
//    */
//   getBackgroundImages(): string[] {
//     const isDev = process.env.NODE_ENV !== 'production'
//     let backgroundsDir: string
//
//     if (isDev) {
//       backgroundsDir = path.join(process.cwd(), 'static', 'thumbnail', 'backgrounds')
//     } else {
//       const { app } = require('electron')
//       const userDataPath = app.getPath('userData')
//       backgroundsDir = path.join(userDataPath, 'backgrounds')
//     }
//
//     try {
//       if (!fs.existsSync(backgroundsDir)) {
//         return []
//       }
//
//       return fs
//         .readdirSync(backgroundsDir)
//         .filter(file => /\.(png|jpg|jpeg)$/i.test(file))
//         .sort()
//     } catch (error) {
//       this.logger.error('배경이미지 목록 조회 실패:', error)
//       return []
//     }
//   }
//
//   /**
//    * 배경이미지 삭제
//    * @param fileName 삭제할 파일명
//    */
//   deleteBackgroundImage(fileName: string): boolean {
//     const filePath = this.getBackgroundImagePath(fileName)
//
//     try {
//       if (fs.existsSync(filePath)) {
//         fs.unlinkSync(filePath)
//         this.logger.log(`배경이미지 삭제 완료: ${filePath}`)
//         return true
//       }
//       return false
//     } catch (error) {
//       this.logger.error(`배경이미지 삭제 실패: ${filePath}`, error)
//       return false
//     }
//   }
//
//   /**
//    * 템플릿 문자열을 실제 값으로 교체
//    * @param text 템플릿 문자열 (예: "{{제목}} - {{부제목}}")
//    * @param variables 교체할 변수들 (예: {제목: "실제 제목", 부제목: "실제 부제목"})
//    */
//   private replaceTemplate(text: string, variables: TemplateVariables): string {
//     return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
//       return variables[key] || match
//     })
//   }
//
//   // 레이아웃 기반 썸네일 생성 (템플릿 변수 지원)
//   async generateThumbnailWithLayout(
//     backgroundImagePath: string,
//     layout: ThumbnailLayoutData,
//     variables: TemplateVariables = {},
//   ): Promise<Buffer> {
//     // 사이즈를 1000x1000으로 고정
//     const width = 1000
//     const height = 1000
//
//     const browser = await chromium.launch({
//       headless: true,
//       executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
//       args: ['--no-sandbox', '--disable-setuid-sandbox'],
//     })
//
//     try {
//       const page = await browser.newPage()
//       await page.setViewportSize({ width, height })
//
//       const html = this.generateLayoutHTML(backgroundImagePath, layout, width, height, variables)
//
//       await page.setContent(html)
//
//       const screenshot = await page.screenshot({
//         type: 'png',
//         clip: {
//           x: 0,
//           y: 0,
//           width,
//           height,
//         },
//       })
//
//       return screenshot
//     } catch (error) {
//       this.logger.error('레이아웃 썸네일 생성 중 오류 발생:', error)
//       throw new Error(`레이아웃 썸네일 생성 실패: ${error.message}`)
//     } finally {
//       await browser.close()
//     }
//   }
//
//   private generateLayoutHTML(
//     backgroundImagePath: string,
//     layout: ThumbnailLayoutData,
//     width: number,
//     height: number,
//     variables: TemplateVariables = {},
//   ): string {
//     // 배경 스타일 설정
//     let backgroundStyle = 'background: #4285f4;' // 기본 배경색
//
//     if (backgroundImagePath && fs.existsSync(backgroundImagePath)) {
//       const backgroundImageBase64 = this.convertImageToBase64(backgroundImagePath)
//       backgroundStyle = `
//         background-image: url('data:image/png;base64,${backgroundImageBase64}');
//         background-size: cover;
//         background-position: center;
//         background-repeat: no-repeat;
//       `
//     }
//
//     // 요소들을 z-index 순으로 정렬
//     const sortedElements = [...layout.elements].sort((a, b) => a.zIndex - b.zIndex)
//
//     // 각 요소의 HTML 생성
//     const elementsHTML = sortedElements
//       .map(element => {
//         const justifyContent =
//           element.textAlign === 'left' ? 'flex-start' : element.textAlign === 'right' ? 'flex-end' : 'center'
//
//         return `
//           <div class="text-element" style="
//             position: absolute;
//             left: ${element.x}%;
//             top: ${element.y}%;
//             width: ${element.width}%;
//             height: ${element.height}%;
//             display: flex;
//             align-items: center;
//             justify-content: ${justifyContent};
//             z-index: ${element.zIndex};
//             transform: rotate(${element.rotation}deg);
//           ">
//             <div style="
//               color: ${element.color};
//               font-size: ${element.fontSize}px;
//               font-family: ${element.fontFamily}, 'Nanum Gothic', 'NanumSquare', sans-serif;
//               font-weight: ${element.fontWeight};
//               opacity: ${element.opacity};
//               text-align: ${element.textAlign};
//               word-wrap: break-word;
//               text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
//               line-height: 1.2;
//               width: 100%;
//             ">
//               ${this.escapeHtml(this.replaceTemplate(element.text, variables))}
//             </div>
//           </div>
//         `
//       })
//       .join('')
//
//     return `
// <!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//
//     <!-- 한국 폰트 임포트 -->
//     <link rel="preconnect" href="https://fonts.googleapis.com">
//     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
//     <style>
//         @import url('http://fonts.googleapis.com/earlyaccess/nanumgothic.css');
//         @import url('https://cdn.rawgit.com/moonspam/NanumSquare/master/nanumsquare.css');
//
//         @font-face {
//             font-family: 'BMDOHYEON';
//             src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMDOHYEON.woff') format('woff');
//             font-weight: normal;
//             font-style: normal;
//         }
//
//         * {
//             margin: 0;
//             padding: 0;
//             box-sizing: border-box;
//         }
//
//         body {
//             width: ${width}px;
//             height: ${height}px;
//             ${backgroundStyle}
//             font-family: 'BMDOHYEON', 'Nanum Gothic', 'NanumSquare', sans-serif;
//             overflow: hidden;
//             position: relative;
//         }
//
//         .overlay {
//             position: absolute;
//             top: 0;
//             left: 0;
//             right: 0;
//             bottom: 0;
//             background: rgba(0, 0, 0, 0.2);
//             z-index: 1;
//         }
//     </style>
// </head>
// <body>
//     ${backgroundImagePath && fs.existsSync(backgroundImagePath) ? '<div class="overlay"></div>' : ''}
//     ${elementsHTML}
// </body>
// </html>
//     `
//   }
//
//   /**
//    * HTML 컨텐츠를 분석하여 썸네일 이미지 생성 (DB 레이아웃 사용)
//    */
//   async generateThumbnailImage(contentHtml: string): Promise<string | null>
//   /**
//    * 제목과 설명으로 썸네일 이미지 생성 (React-Konva 방식)
//    */
//   async generateThumbnailImage(title: string, description?: string): Promise<string | null>
//   async generateThumbnailImage(contentOrTitle: string, description?: string): Promise<string | null> {
//     try {
//       // 두 번째 매개변수가 있으면 title/description 방식으로 처리
//       if (description !== undefined) {
//         this.logger.log(`제목과 설명으로 썸네일 이미지 생성: 제목="${contentOrTitle}", 설명="${description}"`)
//
//         // HTML 형태로 변환하여 기존 로직 재활용
//         const mockHtml = `
//           <html>
//             <body>
//               <h1>${contentOrTitle}</h1>
//               <p>${description || ''}</p>
//             </body>
//           </html>
//         `
//
//         return this.generateThumbnailImageWithKonva(mockHtml, {
//           title: contentOrTitle,
//           subtitle: description || '',
//         })
//       } else {
//         // 기존 HTML 컨텐츠 방식
//         this.logger.log('HTML 컨텐츠로부터 썸네일 이미지 생성을 시작합니다.')
//
//         // OpenAI를 사용하여 썸네일 텍스트 데이터 생성
//         const thumbnailData = await this.openAiService.generateThumbnailData(contentOrTitle)
//
//         // React-Konva 방식으로 썸네일 생성
//         return this.generateThumbnailImageWithKonva(contentOrTitle)
//       }
//     } catch (error) {
//       this.logger.error('썸네일 이미지 생성 중 오류 발생:', error)
//       return null
//     }
//   }
//
//   /**
//    * 기본 레이아웃으로 썸네일 생성 (DB에 레이아웃이 없는 경우)
//    */
//   private async generateThumbnailWithBasicLayout(thumbnailData: {
//     title: string
//     subtitle: string
//   }): Promise<string | null> {
//     try {
//       // 기본 배경 이미지 경로 설정
//       const backgroundImages = this.getBackgroundImages()
//       const defaultBackgroundPath =
//         backgroundImages.length > 0 ? this.getBackgroundImagePath(backgroundImages[0]) : undefined
//
//       // 썸네일 옵션 설정
//       const thumbnailOptions: ThumbnailOptions = {
//         title: thumbnailData.title,
//         subtitle: thumbnailData.subtitle,
//         backgroundImagePath: defaultBackgroundPath,
//         textColor: '#ffffff',
//         fontSize: 60,
//         fontFamily: 'BMDOHYEON',
//       }
//
//       // 썸네일 이미지 생성
//       const thumbnailBuffer = await this.generateThumbnail(thumbnailOptions)
//
//       // 생성된 썸네일을 파일로 저장
//       const timestamp = Date.now()
//       const fileName = `thumbnail_basic_${timestamp}.png`
//       const savedPath = await this.saveBackgroundImage(thumbnailBuffer, fileName)
//
//       // 로컬 파일 경로를 URL로 변환
//       const thumbnailUrl = `file://${savedPath}`
//
//       this.logger.log(`기본 레이아웃 썸네일 이미지 생성 완료: ${thumbnailUrl}`)
//
//       return thumbnailUrl
//     } catch (error) {
//       this.logger.error('기본 레이아웃 썸네일 생성 중 오류 발생:', error)
//       return null
//     }
//   }
//
//   /**
//    * Canvas 기반 썸네일 생성 (일관된 템플릿 작업용)
//    * TODO: canvas 패키지 설치 후 활성화
//    */
//   async generateThumbnailWithCanvas(
//     backgroundImagePath: string,
//     layout: ThumbnailLayoutData,
//     variables: TemplateVariables = {},
//   ): Promise<Buffer> {
//     /*
//     const width = 1000
//     const height = 1000
//
//     // Canvas 생성
//     const canvas = createCanvas(width, height)
//     const ctx = canvas.getContext('2d')
//
//     try {
//       // 배경 설정
//       await this.drawBackground(ctx, backgroundImagePath, width, height)
//
//       // 레이아웃 요소들을 z-index 순으로 정렬하여 그리기
//       const sortedElements = [...layout.elements].sort((a, b) => a.zIndex - b.zIndex)
//
//       for (const element of sortedElements) {
//         await this.drawTextElement(ctx, element, variables)
//       }
//
//       // Canvas를 Buffer로 변환
//       return canvas.toBuffer('image/png')
//     } catch (error) {
//       this.logger.error('Canvas 썸네일 생성 중 오류:', error)
//       throw new Error(`Canvas 썸네일 생성 실패: ${error.message}`)
//     }
//     */
//
//     // 임시로 기본 썸네일 생성 방식 사용
//     throw new Error('Canvas 패키지 설치 후 사용 가능합니다.')
//   }
//
//   /**
//    * Canvas에 배경 그리기
//    * TODO: canvas 패키지 설치 후 활성화
//    */
//   private async drawBackground(
//     ctx: any, // CanvasRenderingContext2D
//     backgroundImagePath: string,
//     width: number,
//     height: number,
//   ): Promise<void> {
//     // Canvas 패키지 설치 후 구현
//     throw new Error('Canvas 패키지 설치 후 사용 가능합니다.')
//   }
//
//   /**
//    * Canvas에 텍스트 요소 그리기
//    * TODO: canvas 패키지 설치 후 활성화
//    */
//   private async drawTextElement(
//     ctx: any, // CanvasRenderingContext2D
//     element: ThumbnailLayoutElement,
//     variables: TemplateVariables,
//   ): Promise<void> {
//     // Canvas 패키지 설치 후 구현
//     throw new Error('Canvas 패키지 설치 후 사용 가능합니다.')
//   }
//
//   /**
//    * Canvas 기반으로 썸네일 이미지 생성 (개선된 버전)
//    */
//   async generateThumbnailImageWithCanvas(contentHtml: string): Promise<string | null> {
//     try {
//       this.logger.log('Canvas를 사용하여 썸네일 이미지 생성을 시작합니다.')
//
//       // OpenAI를 사용하여 썸네일 텍스트 데이터 생성
//       const thumbnailData = await this.openAiService.generateThumbnailData(contentHtml)
//
//       // DB에서 기본 썸네일 레이아웃 가져오기 (임시로 하드코딩)
//       // TODO: Prisma 타입 오류 해결 후 활성화
//       /*
//       let thumbnailLayout = await this.prisma.thumbnailLayout.findFirst({
//         where: { isDefault: true },
//         orderBy: { createdAt: 'desc' },
//       })
//
//       if (!thumbnailLayout) {
//         thumbnailLayout = await this.prisma.thumbnailLayout.findFirst({
//           orderBy: { createdAt: 'desc' },
//         })
//       }
//       */
//
//       // 임시 기본 레이아웃 (나중에 DB에서 가져오도록 수정)
//       const defaultLayout: ThumbnailLayoutData = {
//         id: 'default',
//         backgroundImage: 'background_8453dcbb73d2f44c.png',
//         elements: [
//           {
//             id: 'title',
//             text: '{{제목}}',
//             x: 10, // 10%
//             y: 30, // 30%
//             width: 80, // 80%
//             height: 20, // 20%
//             fontSize: 60,
//             fontFamily: 'BMDOHYEON',
//             color: '#ffffff',
//             textAlign: 'center',
//             fontWeight: 'bold',
//             opacity: 1,
//             rotation: 0,
//             zIndex: 2,
//           },
//           {
//             id: 'subtitle',
//             text: '{{부제목}}',
//             x: 10, // 10%
//             y: 55, // 55%
//             width: 80, // 80%
//             height: 15, // 15%
//             fontSize: 36,
//             fontFamily: 'BMDOHYEON',
//             color: '#ffffff',
//             textAlign: 'center',
//             fontWeight: 'normal',
//             opacity: 0.9,
//             rotation: 0,
//             zIndex: 2,
//           },
//         ],
//         createdAt: new Date().toISOString(),
//         updatedAt: new Date().toISOString(),
//       }
//
//       // 배경 이미지 경로 설정
//       const backgroundImagePath = this.getBackgroundImagePath(defaultLayout.backgroundImage)
//
//       // 템플릿 변수 설정
//       const templateVariables: TemplateVariables = {
//         제목: thumbnailData.title,
//         부제목: thumbnailData.subtitle,
//         title: thumbnailData.title,
//         subtitle: thumbnailData.subtitle,
//       }
//
//       // Canvas 기반 썸네일 생성 (임시로 기본 방식 사용)
//       // TODO: canvas 패키지 설치 후 Canvas 방식 사용
//       const thumbnailOptions: ThumbnailOptions = {
//         title: thumbnailData.title,
//         subtitle: thumbnailData.subtitle,
//         backgroundImagePath,
//         textColor: '#ffffff',
//         fontSize: 60,
//         fontFamily: 'BMDOHYEON',
//       }
//
//       const thumbnailBuffer = await this.generateThumbnail(thumbnailOptions)
//
//       // 생성된 썸네일을 파일로 저장
//       const timestamp = Date.now()
//       const fileName = `thumbnail_canvas_${timestamp}.png`
//       const savedPath = await this.saveBackgroundImage(thumbnailBuffer, fileName)
//
//       // 로컬 파일 경로를 URL로 변환
//       const thumbnailUrl = `file://${savedPath}`
//
//       this.logger.log(`Canvas 썸네일 이미지 생성 완료: ${thumbnailUrl}`)
//
//       return thumbnailUrl
//     } catch (error) {
//       this.logger.error('Canvas 썸네일 이미지 생성 중 오류 발생:', error)
//       return null
//     }
//   }
//
//   /**
//    * React-Konva 기반 썸네일 생성 (Playwright + HTML 템플릿 방식)
//    */
//   async generateThumbnailImageWithKonva(
//     contentHtml: string,
//     predefinedData?: { title: string; subtitle: string },
//   ): Promise<string | null> {
//     try {
//       this.logger.log('렌더 프로세스 라우팅 방식으로 썸네일 이미지 생성을 시작합니다.')
//
//       // predefinedData가 제공되면 사용, 없으면 OpenAI로 생성
//       const thumbnailData = predefinedData || (await this.openAiService.generateThumbnailData(contentHtml))
//
//       // 레이아웃 데이터 (임시)
//       const defaultLayout: ThumbnailLayoutData = {
//         id: 'default',
//         backgroundImage: 'background_8453dcbb73d2f44c.png',
//         elements: [
//           {
//             id: 'title',
//             text: '{{제목}}',
//             x: 10,
//             y: 30,
//             width: 80,
//             height: 20,
//             fontSize: 60,
//             fontFamily: 'BMDOHYEON',
//             color: '#ffffff',
//             textAlign: 'center',
//             fontWeight: 'bold',
//             opacity: 1,
//             rotation: 0,
//             zIndex: 2,
//           },
//           {
//             id: 'subtitle',
//             text: '{{부제목}}',
//             x: 10,
//             y: 55,
//             width: 80,
//             height: 15,
//             fontSize: 36,
//             fontFamily: 'BMDOHYEON',
//             color: '#ffffff',
//             textAlign: 'center',
//             fontWeight: 'normal',
//             opacity: 0.9,
//             rotation: 0,
//             zIndex: 2,
//           },
//         ],
//         createdAt: new Date().toISOString(),
//         updatedAt: new Date().toISOString(),
//       }
//
//       // 배경 이미지 절대 경로 설정 (file:// URL로)
//       const backgroundImagePath = this.getBackgroundImagePath(defaultLayout.backgroundImage)
//       const backgroundImageUrl = `file://${backgroundImagePath}`
//
//       // 템플릿 변수 설정
//       const templateVariables: TemplateVariables = {
//         제목: thumbnailData.title,
//         부제목: thumbnailData.subtitle,
//         title: thumbnailData.title,
//         subtitle: thumbnailData.subtitle,
//       }
//
//       this.logger.log('렌더 프로세스 라우팅으로 썸네일 생성 시작')
//
//       // 렌더 프로세스 라우팅으로 썸네일 생성
//       const dataUrl = await this.generateThumbnailWithPlaywright({
//         layout: defaultLayout,
//         variables: templateVariables,
//         backgroundImagePath: backgroundImageUrl,
//       })
//
//       if (!dataUrl) {
//         this.logger.warn('렌더 프로세스 라우팅 썸네일 생성 실패, 기본 방식으로 대체합니다.')
//         return this.generateThumbnailImageWithCanvas(contentHtml)
//       }
//
//       // dataURL을 Buffer로 변환하여 파일로 저장
//       const thumbnailUrl = await this.saveDataUrlAsFile(dataUrl)
//
//       this.logger.log(`렌더 프로세스 라우팅 썸네일 이미지 생성 완료: ${thumbnailUrl}`)
//
//       return thumbnailUrl
//     } catch (error) {
//       this.logger.error('렌더 프로세스 라우팅 썸네일 이미지 생성 중 오류 발생:', error)
//       return null
//     }
//   }
//
//   /**
//    * Playwright로 독립 HTML 페이지에서 썸네일 생성
//    */
//   private async generateThumbnailWithPlaywright(config: {
//     layout: ThumbnailLayoutData
//     variables: TemplateVariables
//     backgroundImagePath: string
//   }): Promise<string | null> {
//     try {
//       // 메인 윈도우 가져오기
//       const windows = BrowserWindow.getAllWindows()
//       const mainWindow = windows.find(window => !window.isDestroyed())
//
//       if (!mainWindow) {
//         throw new Error('메인 윈도우를 찾을 수 없습니다.')
//       }
//
//       this.logger.log('Electron 렌더 프로세스 라우팅을 통한 썸네일 생성 시작')
//
//       // 현재 URL 백업
//       const currentUrl = await mainWindow.webContents.executeJavaScript('window.location.href')
//
//       // 설정을 URL 파라미터로 인코딩
//       const configParam = encodeURIComponent(JSON.stringify(config))
//       const thumbnailUrl = `/thumbnail-generator?config=${configParam}`
//
//       this.logger.log(`썸네일 페이지로 이동: ${thumbnailUrl}`)
//
//       // 썸네일 페이지로 이동
//       await mainWindow.webContents.executeJavaScript(`
//         window.location.hash = '${thumbnailUrl}'
//       `)
//
//       // 페이지 로딩 및 컴포넌트 준비 대기 (최대 10초)
//       await mainWindow.webContents.executeJavaScript(`
//         new Promise((resolve, reject) => {
//           let attempts = 0
//           const maxAttempts = 100 // 10초
//
//           const checkReady = () => {
//             attempts++
//             if (window.thumbnailReady) {
//               resolve(true)
//             } else if (attempts >= maxAttempts) {
//               reject(new Error('썸네일 페이지 준비 타임아웃'))
//             } else {
//               setTimeout(checkReady, 100)
//             }
//           }
//           checkReady()
//         })
//       `)
//
//       this.logger.log('썸네일 페이지 준비 완료, 캡쳐 시작')
//
//       // 캡쳐 실행
//       const dataUrl = await mainWindow.webContents.executeJavaScript(`
//         window.captureThumbnail ? window.captureThumbnail() : null
//       `)
//
//       // 원래 페이지로 복원
//       this.logger.log('원래 페이지로 복원 중...')
//       await mainWindow.webContents.executeJavaScript(`
//         window.location.href = '${currentUrl}'
//       `)
//
//       if (!dataUrl || !dataUrl.startsWith('data:image/')) {
//         throw new Error('유효하지 않은 썸네일 캡쳐 결과')
//       }
//
//       this.logger.log('Electron 렌더 프로세스 썸네일 생성 성공')
//       return dataUrl
//     } catch (error) {
//       this.logger.error('Electron 렌더 프로세스 썸네일 생성 실패:', error)
//
//       // 오류 발생 시 메인 페이지로 복원 시도
//       try {
//         const windows = BrowserWindow.getAllWindows()
//         const mainWindow = windows.find(window => !window.isDestroyed())
//         if (mainWindow) {
//           await mainWindow.webContents.executeJavaScript(`
//             window.location.hash = '/'
//           `)
//         }
//       } catch (restoreError) {
//         this.logger.error('페이지 복원 실패:', restoreError)
//       }
//
//       return null
//     }
//   }
//
//   /**
//    * 렌더 프로세스에 썸네일 생성 요청 (직접 실행 방식) - 레거시
//    */
//   private async requestThumbnailFromRenderer(request: any): Promise<string | null> {
//     try {
//       // 메인 윈도우 찾기
//       const mainWindow = BrowserWindow.getAllWindows().find(window => !window.isDestroyed())
//
//       if (!mainWindow) {
//         this.logger.error('메인 윈도우를 찾을 수 없습니다.')
//         return null
//       }
//
//       this.logger.log('렌더 프로세스에서 직접 React-Konva 썸네일 생성 요청 시작')
//
//       // 더 직접적이고 빠른 방식으로 렌더 프로세스에서 JavaScript 실행
//       const result = await mainWindow.webContents.executeJavaScript(`
//         new Promise((resolve, reject) => {
//           try {
//             // Konva 썸네일 생성 요청 데이터
//             const requestData = ${JSON.stringify(request)};
//
//             // 우선순위: 동기식 > 직접 > 기존 함수
//             if (typeof window.generateThumbnailSync === 'function') {
//               console.log('동기식 썸네일 생성 함수 사용 (가장 빠른 방식)');
//               window.generateThumbnailSync(requestData)
//                 .then(dataUrl => resolve({ success: true, dataUrl, method: 'sync' }))
//                 .catch(error => {
//                   console.warn('동기식 방식 실패, 직접 방식으로 폴백:', error.message);
//                   // 동기식 방식 실패 시 직접 방식으로 폴백
//                   if (typeof window.generateThumbnailDirectly === 'function') {
//                     window.generateThumbnailDirectly(requestData)
//                       .then(dataUrl => resolve({ success: true, dataUrl, method: 'direct' }))
//                       .catch(directError => {
//                         console.warn('직접 방식도 실패, 기존 방식으로 폴백:', directError.message);
//                         // 직접 방식도 실패 시 기존 방식으로 폴백
//                         if (typeof window.generateKonvaThumbnail === 'function') {
//                           window.generateKonvaThumbnail(requestData)
//                             .then(dataUrl => resolve({ success: true, dataUrl, method: 'legacy' }))
//                             .catch(legacyError => resolve({ success: false, error: legacyError.message }));
//                         } else {
//                           resolve({ success: false, error: '모든 썸네일 생성 함수를 찾을 수 없습니다.' });
//                         }
//                       });
//                   } else {
//                     resolve({ success: false, error: '폴백 썸네일 생성 함수를 찾을 수 없습니다.' });
//                   }
//                 });
//             } else if (typeof window.generateThumbnailDirectly === 'function') {
//               console.log('직접 썸네일 생성 함수 사용 (빠른 방식)');
//               window.generateThumbnailDirectly(requestData)
//                 .then(dataUrl => resolve({ success: true, dataUrl, method: 'direct' }))
//                 .catch(error => {
//                   console.warn('직접 방식 실패, 기존 방식으로 폴백:', error.message);
//                   // 직접 방식 실패 시 기존 방식으로 폴백
//                   if (typeof window.generateKonvaThumbnail === 'function') {
//                     window.generateKonvaThumbnail(requestData)
//                       .then(dataUrl => resolve({ success: true, dataUrl, method: 'fallback' }))
//                       .catch(fallbackError => resolve({ success: false, error: fallbackError.message }));
//                   } else {
//                     resolve({ success: false, error: '폴백 썸네일 생성 함수를 찾을 수 없습니다.' });
//                   }
//                 });
//             } else if (typeof window.generateKonvaThumbnail === 'function') {
//               console.log('기존 썸네일 생성 함수 사용');
//               window.generateKonvaThumbnail(requestData)
//                 .then(dataUrl => resolve({ success: true, dataUrl, method: 'legacy' }))
//                 .catch(error => resolve({ success: false, error: error.message }));
//             } else {
//               resolve({ success: false, error: '썸네일 생성 함수를 찾을 수 없습니다.' });
//             }
//           } catch (error) {
//             resolve({ success: false, error: error.message });
//           }
//         });
//       `)
//
//       if (result.success) {
//         this.logger.log(`React-Konva 썸네일 생성 성공 (방식: ${result.method})`)
//         return result.dataUrl
//       } else {
//         this.logger.error(`React-Konva 썸네일 생성 실패: ${result.error}`)
//         return null
//       }
//     } catch (error) {
//       this.logger.error('렌더 프로세스 JavaScript 실행 오류:', error)
//       return null
//     }
//   }
//
//   /**
//    * dataURL을 파일로 저장
//    */
//   private async saveDataUrlAsFile(dataUrl: string): Promise<string> {
//     try {
//       // base64 데이터 추출
//       const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
//       const buffer = Buffer.from(base64Data, 'base64')
//
//       // 파일명 생성
//       const timestamp = Date.now()
//       const fileName = `thumbnail_konva_${timestamp}.png`
//
//       // 파일 저장
//       const savedPath = await this.saveBackgroundImage(buffer, fileName)
//
//       // URL 형식으로 반환
//       return `file://${savedPath}`
//     } catch (error) {
//       this.logger.error('dataURL 파일 저장 중 오류:', error)
//       throw error
//     }
//   }
//
//   /**
//    * 렌더 프로세스 라우팅 방식 테스트 함수
//    */
//   async testRouterBasedThumbnailGeneration(): Promise<void> {
//     try {
//       this.logger.log('🧪 렌더 프로세스 라우팅 썸네일 생성 테스트 시작')
//
//       const testTitle = '테스트 제목'
//       const testDescription = '테스트 설명'
//
//       const result = await this.generateThumbnailImage(testTitle, testDescription)
//
//       if (result) {
//         this.logger.log(`✅ 테스트 성공! 썸네일 생성 완료: ${result}`)
//       } else {
//         this.logger.error('❌ 테스트 실패: 썸네일 생성 결과가 null')
//       }
//     } catch (error) {
//       this.logger.error('❌ 테스트 중 오류 발생:', error)
//     }
//   }
// }
