import React, { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Text, Image as KonvaImage } from 'react-konva'
import useImage from 'use-image'

interface ThumbnailLayoutElement {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  fontWeight: 'normal' | 'bold'
  opacity: number
  rotation: number
  zIndex: number
}

interface ThumbnailLayoutData {
  id: string
  backgroundImage: string
  elements: ThumbnailLayoutElement[]
  createdAt: string
  updatedAt: string
}

interface ThumbnailGeneratorProps {
  layout: ThumbnailLayoutData
  variables: { [key: string]: string }
  backgroundImagePath?: string
  onGenerated?: (dataUrl: string) => void
  width?: number
  height?: number
}

// 배경 이미지 컴포넌트
const BackgroundImage: React.FC<{ src: string; width: number; height: number }> = ({ src, width, height }) => {
  const [image] = useImage(src)

  if (!image) return null

  // 이미지를 캔버스 크기에 맞게 조정 (cover 효과)
  const imgAspect = image.width / image.height
  const canvasAspect = width / height

  let drawWidth,
    drawHeight,
    offsetX = 0,
    offsetY = 0

  if (imgAspect > canvasAspect) {
    // 이미지가 더 넓음
    drawHeight = height
    drawWidth = height * imgAspect
    offsetX = -(drawWidth - width) / 2
  } else {
    // 이미지가 더 높음
    drawWidth = width
    drawHeight = width / imgAspect
    offsetY = -(drawHeight - height) / 2
  }

  return (
    <>
      <KonvaImage image={image} x={offsetX} y={offsetY} width={drawWidth} height={drawHeight} />
      {/* 오버레이 */}
      <Rect x={0} y={0} width={width} height={height} fill="rgba(0, 0, 0, 0.3)" />
    </>
  )
}

// 텍스트 요소 컴포넌트
const TextElement: React.FC<{ element: ThumbnailLayoutElement; variables: { [key: string]: string } }> = ({
  element,
  variables,
}) => {
  // 템플릿 변수 치환
  const replaceTemplate = (text: string, vars: { [key: string]: string }): string => {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      return vars[key] || match
    })
  }

  const text = replaceTemplate(element.text, variables)

  if (!text.trim()) return null

  // 퍼센트를 픽셀로 변환 (1000px 기준)
  const x = element.x * 10
  const y = element.y * 10
  const width = element.width * 10
  const height = element.height * 10

  return (
    <Text
      x={x}
      y={y}
      width={width}
      height={height}
      text={text}
      fontSize={element.fontSize}
      fontFamily={element.fontFamily}
      fill={element.color}
      align={element.textAlign}
      verticalAlign="middle"
      fontStyle={element.fontWeight}
      opacity={element.opacity}
      rotation={element.rotation}
      shadowColor="rgba(0, 0, 0, 0.7)"
      shadowOffset={{ x: 2, y: 2 }}
      shadowBlur={4}
      wrap="word"
    />
  )
}

export const ThumbnailKonvaGenerator: React.FC<ThumbnailGeneratorProps> = ({
  layout,
  variables,
  backgroundImagePath,
  onGenerated,
  width = 1000,
  height = 1000,
}) => {
  const stageRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // 썸네일 생성 함수
  const generateThumbnail = async () => {
    if (!stageRef.current) return

    try {
      // 약간의 지연을 두어 렌더링 완료 대기
      setTimeout(() => {
        const dataUrl = stageRef.current.toDataURL({
          pixelRatio: 2,
          mimeType: 'image/png',
          quality: 1,
          width,
          height,
        })

        onGenerated?.(dataUrl)
      }, 100)
    } catch (error) {
      console.error('썸네일 생성 중 오류:', error)
    }
  }

  // 컴포넌트가 마운트되면 썸네일 생성
  useEffect(() => {
    if (isLoaded) {
      generateThumbnail()
    }
  }, [isLoaded, layout, variables])

  // 레이아웃 로딩 완료 처리
  useEffect(() => {
    // 이미지 로딩 시간 고려
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [backgroundImagePath])

  // 요소들을 z-index 순으로 정렬
  const sortedElements = [...layout.elements].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="thumbnail-konva-generator">
      <Stage width={width} height={height} ref={stageRef}>
        <Layer>
          {/* 기본 배경색 */}
          <Rect x={0} y={0} width={width} height={height} fill="#4285f4" />

          {/* 배경 이미지 */}
          {backgroundImagePath && <BackgroundImage src={backgroundImagePath} width={width} height={height} />}

          {/* 텍스트 요소들 */}
          {sortedElements.map(element => (
            <TextElement key={element.id} element={element} variables={variables} />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}

// 헤드리스 썸네일 생성을 위한 컴포넌트 (숨김)
export const HiddenThumbnailGenerator: React.FC<ThumbnailGeneratorProps> = props => {
  return (
    <div style={{ position: 'absolute', left: '-10000px', top: '-10000px', visibility: 'hidden' }}>
      <ThumbnailKonvaGenerator {...props} />
    </div>
  )
}
