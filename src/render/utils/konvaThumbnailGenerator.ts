// import React from 'react'
// import ReactDOM from 'react-dom/client'
// import { HiddenThumbnailGenerator } from '../components/ThumbnailEditor/ThumbnailKonvaGenerator'
//
// // 썸네일 생성 요청 인터페이스
// interface ThumbnailRequest {
//   layout: any
//   variables: { [key: string]: string }
//   backgroundImagePath?: string
// }
//
// // 전역 함수 타입 선언
// declare global {
//   interface Window {
//     generateKonvaThumbnail: (request: ThumbnailRequest) => Promise<string>
//     generateThumbnailDirectly: (request: ThumbnailRequest) => Promise<string>
//     generateThumbnailSync: (request: ThumbnailRequest) => Promise<string>
//   }
// }
//
// /**
//  * 동기식 썸네일 생성 함수 (가장 직접적인 방식)
//  */
// async function generateThumbnailSync(request: ThumbnailRequest): Promise<string> {
//   return new Promise((resolve, reject) => {
//     console.log('동기식 썸네일 생성 시작:', request)
//
//     // 즉시 실행되는 컨테이너 (더 빠른 처리)
//     const container = document.createElement('div')
//     container.style.cssText = `
//       position: fixed;
//       left: -30000px;
//       top: -30000px;
//       width: 1000px;
//       height: 1000px;
//       visibility: hidden;
//       opacity: 0;
//       pointer-events: none;
//       z-index: -99999;
//     `
//     document.body.appendChild(container)
//
//     let isResolved = false
//     let cleanup: (() => void) | null = null
//
//     // 빠른 타임아웃 (10초)
//     const timeout = setTimeout(() => {
//       if (!isResolved && cleanup) {
//         cleanup()
//         reject(new Error('동기식 썸네일 생성 타임아웃 (10초)'))
//       }
//     }, 10000)
//
//     // 정리 함수
//     cleanup = () => {
//       if (isResolved) return
//       isResolved = true
//       clearTimeout(timeout)
//
//       // 약간의 지연 후 정리 (Konva 완료 대기)
//       setTimeout(() => {
//         try {
//           if (container.parentNode) {
//             container.parentNode.removeChild(container)
//           }
//         } catch (e) {
//           console.warn('동기식 컨테이너 정리 오류:', e)
//         }
//       }, 100)
//     }
//
//     // 즉시 생성 완료 핸들러
//     const onGenerated = (dataUrl: string) => {
//       console.log('동기식 썸네일 생성 완료')
//       cleanup()
//       resolve(dataUrl)
//     }
//
//     // 에러 핸들러
//     const onError = (error: any) => {
//       console.error('동기식 썸네일 생성 오류:', error)
//       cleanup()
//       reject(error)
//     }
//
//     try {
//       // React 18의 createRoot 사용
//       const root = ReactDOM.createRoot(container)
//
//       const element = React.createElement(HiddenThumbnailGenerator, {
//         layout: request.layout,
//         variables: request.variables,
//         backgroundImagePath: request.backgroundImagePath,
//         onGenerated,
//         width: 1000,
//         height: 1000,
//       })
//
//       root.render(element)
//       console.log('동기식 React-Konva 컴포넌트 렌더링 완료')
//
//       // 정리 함수에 루트 언마운트 추가
//       const originalCleanup = cleanup
//       cleanup = () => {
//         try {
//           root.unmount()
//         } catch (e) {
//           console.warn('동기식 React 루트 언마운트 오류:', e)
//         }
//         originalCleanup()
//       }
//
//     } catch (error) {
//       onError(error)
//     }
//   })
// }
//
// /**
//  * 직접적인 썸네일 생성 함수 (더 빠르고 간단함)
//  */
// async function generateThumbnailDirectly(request: ThumbnailRequest): Promise<string> {
//   return new Promise((resolve, reject) => {
//     console.log('직접 썸네일 생성 시작:', request)
//
//     // 임시 컨테이너 생성 (완전히 숨김)
//     const container = document.createElement('div')
//     container.style.cssText = `
//       position: absolute;
//       left: -20000px;
//       top: -20000px;
//       width: 1000px;
//       height: 1000px;
//       visibility: hidden;
//       pointer-events: none;
//       z-index: -9999;
//     `
//     document.body.appendChild(container)
//
//     let cleanup: (() => void) | null = null
//
//     // 타임아웃 설정
//     const timeout = setTimeout(() => {
//       if (cleanup) cleanup()
//       reject(new Error('썸네일 생성 타임아웃 (20초)'))
//     }, 20000)
//
//     // 정리 함수
//     cleanup = () => {
//       clearTimeout(timeout)
//       try {
//         if (container.parentNode) {
//           container.parentNode.removeChild(container)
//         }
//       } catch (e) {
//         console.warn('컨테이너 정리 오류:', e)
//       }
//     }
//
//     // 생성 완료 핸들러
//     const onGenerated = (dataUrl: string) => {
//       console.log('직접 썸네일 생성 완료')
//       cleanup()
//       resolve(dataUrl)
//     }
//
//     // 에러 핸들러
//     const onError = (error: any) => {
//       console.error('직접 썸네일 생성 오류:', error)
//       cleanup()
//       reject(error)
//     }
//
//     try {
//       // React 루트 생성 및 렌더링
//       const root = ReactDOM.createRoot(container)
//
//       const element = React.createElement(HiddenThumbnailGenerator, {
//         layout: request.layout,
//         variables: request.variables,
//         backgroundImagePath: request.backgroundImagePath,
//         onGenerated,
//         width: 1000,
//         height: 1000,
//       })
//
//       root.render(element)
//
//       // 정리 함수에 루트 언마운트 추가
//       const originalCleanup = cleanup
//       cleanup = () => {
//         try {
//           root.unmount()
//         } catch (e) {
//           console.warn('React 루트 언마운트 오류:', e)
//         }
//         originalCleanup()
//       }
//
//     } catch (error) {
//       onError(error)
//     }
//   })
// }
//
// /**
//  * React-Konva를 사용하여 썸네일을 생성하는 전역 함수 (기존 방식)
//  */
// async function generateKonvaThumbnail(request: ThumbnailRequest): Promise<string> {
//   return new Promise((resolve, reject) => {
//     try {
//       console.log('React-Konva 썸네일 생성 시작:', request)
//
//       // 숨겨진 컨테이너 DIV 생성
//       const hiddenContainer = document.createElement('div')
//       hiddenContainer.style.position = 'absolute'
//       hiddenContainer.style.left = '-10000px'
//       hiddenContainer.style.top = '-10000px'
//       hiddenContainer.style.visibility = 'hidden'
//       hiddenContainer.style.pointerEvents = 'none'
//       document.body.appendChild(hiddenContainer)
//
//       // React 루트 생성
//       const root = ReactDOM.createRoot(hiddenContainer)
//
//       // 썸네일 생성 완료 콜백
//       const handleGenerated = (dataUrl: string) => {
//         console.log('썸네일 생성 완료, 정리 중...')
//
//         // 5초 후에 정리 (Konva 렌더링 완료 대기)
//         setTimeout(() => {
//           try {
//             root.unmount()
//             document.body.removeChild(hiddenContainer)
//             console.log('썸네일 생성 및 정리 완료')
//             resolve(dataUrl)
//           } catch (cleanupError) {
//             console.warn('정리 중 오류 발생:', cleanupError)
//             resolve(dataUrl) // 그래도 결과는 반환
//           }
//         }, 1000)
//       }
//
//       // 에러 처리
//       const handleError = (error: any) => {
//         console.error('썸네일 생성 중 오류:', error)
//         try {
//           root.unmount()
//           document.body.removeChild(hiddenContainer)
//         } catch (cleanupError) {
//           console.warn('에러 정리 중 오류:', cleanupError)
//         }
//         reject(error)
//       }
//
//       // 타임아웃 설정 (30초)
//       const timeout = setTimeout(() => {
//         handleError(new Error('썸네일 생성 타임아웃'))
//       }, 30000)
//
//       // 성공 시 타임아웃 제거
//       const originalHandleGenerated = handleGenerated
//       const wrappedHandleGenerated = (dataUrl: string) => {
//         clearTimeout(timeout)
//         originalHandleGenerated(dataUrl)
//       }
//
//       // React 컴포넌트 렌더링
//       const element = React.createElement(HiddenThumbnailGenerator, {
//         layout: request.layout,
//         variables: request.variables,
//         backgroundImagePath: request.backgroundImagePath,
//         onGenerated: wrappedHandleGenerated,
//         width: 1000,
//         height: 1000,
//       })
//
//       root.render(element)
//       console.log('React-Konva 컴포넌트 렌더링 완료')
//
//     } catch (error) {
//       console.error('generateKonvaThumbnail 실행 오류:', error)
//       reject(error)
//     }
//   })
// }
//
// /**
//  * 전역 함수 설정
//  */
// export function setupKonvaThumbnailGenerator(): void {
//   try {
//     // 전역 객체에 함수 등록
//     window.generateKonvaThumbnail = generateKonvaThumbnail
//     window.generateThumbnailDirectly = generateThumbnailDirectly
//     window.generateThumbnailSync = generateThumbnailSync
//     console.log('React-Konva 썸네일 생성 함수가 전역으로 등록되었습니다.')
//   } catch (error) {
//     console.error('전역 함수 등록 중 오류:', error)
//   }
// }
//
// /**
//  * 테스트용 함수
//  */
// export async function testKonvaThumbnail(): Promise<void> {
//   try {
//     const testRequest: ThumbnailRequest = {
//       layout: {
//         id: 'test',
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
//         ],
//         createdAt: new Date().toISOString(),
//         updatedAt: new Date().toISOString(),
//       },
//       variables: {
//         제목: '테스트 제목',
//         부제목: '테스트 부제목',
//       },
//     }
//
//     console.log('동기식 썸네일 생성 테스트 시작...')
//     const dataUrl = await window.generateThumbnailSync(testRequest)
//     console.log('테스트 썸네일 생성 완료:', dataUrl.substring(0, 100) + '...')
//   } catch (error) {
//     console.error('썸네일 생성 테스트 실패:', error)
//   }
// }
//
// /**
//  * React Hook 스타일의 썸네일 생성 유틸리티
//  */
// export const useThumbnailGenerator = () => {
//   const generateThumbnail = async (request: ThumbnailRequest): Promise<string> => {
//     // 동기식 방식 우선 시도
//     try {
//       return await generateThumbnailSync(request)
//     } catch (error) {
//       console.warn('동기식 방식 실패, 직접 방식으로 폴백:', error)
//       try {
//         return await generateThumbnailDirectly(request)
//       } catch (directError) {
//         console.warn('직접 방식 실패, 기존 방식으로 폴백:', directError)
//         return await generateKonvaThumbnail(request)
//       }
//     }
//   }
//
//   return { generateThumbnail }
// }
