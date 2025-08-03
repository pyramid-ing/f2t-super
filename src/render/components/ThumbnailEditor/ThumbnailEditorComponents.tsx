import React, { useRef, useEffect } from 'react'
import { Text as KonvaText, Image as KonvaImage, Transformer, Line } from 'react-konva'
import { TextElement } from '../../types/thumbnail'
import Konva from 'konva'
import useImage from 'use-image'

// 배경 이미지 컴포넌트
export const BackgroundImage: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  const [image] = useImage(imageUrl)
  return <KonvaImage image={image} x={0} y={0} width={1000} height={1000} listening={false} />
}

// 텍스트 요소 컴포넌트
export const EditableText: React.FC<{
  element: TextElement
  isSelected: boolean
  isEditing: boolean
  onSelect: () => void
  onTransform: (id: string, attrs: any) => void
  onDoubleClick: () => void
  fontsLoaded: boolean
}> = ({ element, isSelected, isEditing, onSelect, onTransform, onDoubleClick, fontsLoaded }) => {
  const textRef = useRef<Konva.Text>(null)
  const transformerRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && transformerRef.current && textRef.current && !isEditing) {
      transformerRef.current.nodes([textRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected, isEditing])

  const handleSelect = (e: any) => {
    console.log('텍스트 클릭됨:', element.id)
    e.cancelBubble = true // 이벤트 버블링 중단
    onSelect()
  }

  const handleDoubleClick = (e: any) => {
    console.log('텍스트 더블클릭됨:', element.id)
    e.cancelBubble = true // 이벤트 버블링 중단
    onDoubleClick()
  }

  return (
    <>
      <KonvaText
        key={`${element.id}-${element.fontFamily}-${fontsLoaded}`}
        ref={textRef}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        text={element.text}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.color}
        opacity={isEditing ? 0.3 : element.opacity}
        align={element.textAlign}
        wrap="word"
        draggable={!isEditing}
        onClick={handleSelect}
        onTap={handleSelect}
        onDblClick={handleDoubleClick}
        onDbltap={handleDoubleClick}
        onDragEnd={e => {
          onTransform(element.id, {
            x: e.target.x(),
            y: e.target.y(),
          })
        }}
        onTransformEnd={e => {
          const node = e.target as Konva.Text
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()

          // 새로운 width와 height 계산
          const newWidth = Math.max(50, element.width * scaleX)
          const newHeight = Math.max(20, element.height * scaleY)

          // 스케일 초기화
          node.scaleX(1)
          node.scaleY(1)

          onTransform(element.id, {
            x: node.x(),
            y: node.y(),
            width: newWidth,
            height: newHeight,
          })
        }}
      />
      {isSelected && !isEditing && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // 최소 텍스트 박스 크기 제한
            if (newBox.width < 50 || newBox.height < 20) {
              return oldBox
            }
            // 최대 텍스트 박스 크기 제한 (캔버스 크기 내)
            if (newBox.width > 900 || newBox.height > 800) {
              return {
                ...newBox,
                width: Math.min(newBox.width, 900),
                height: Math.min(newBox.height, 800),
              }
            }
            return newBox
          }}
          keepRatio={false}
        />
      )}
    </>
  )
}

// 격자 그리드 컴포넌트
export const Grid: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null

  const gridLines = []
  const step = 50

  for (let i = 0; i <= 1000; i += step) {
    gridLines.push(<Line key={`v-${i}`} points={[i, 0, i, 1000]} stroke="#e8e8e8" strokeWidth={1} listening={false} />)
  }

  for (let i = 0; i <= 1000; i += step) {
    gridLines.push(<Line key={`h-${i}`} points={[0, i, 1000, i]} stroke="#e8e8e8" strokeWidth={1} listening={false} />)
  }

  return <>{gridLines}</>
}
