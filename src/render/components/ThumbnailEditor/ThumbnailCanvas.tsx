import React from 'react'
import { Stage, Layer, Text, Image as KonvaImage } from 'react-konva'
import { Button, Space } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { BackgroundImage, EditableText, Grid } from './ThumbnailEditorComponents'
import { ThumbnailLayout, EditorState, TextElement } from '../../types/thumbnail'
import Konva from 'konva'
import useImage from 'use-image'

interface ThumbnailCanvasProps {
  layout: ThumbnailLayout
  backgroundImageBase64: string
  fontsLoaded: boolean
  editorState: EditorState
  editingElementId: string | null
  editingText: string
  editingPosition: { x: number; y: number }
  selectedElement: TextElement | null
  stageRef: React.RefObject<Konva.Stage>
  onSave: () => void
  onCancel: () => void
  onElementSelect: (id: string | null) => void
  onElementTransform: (id: string, attrs: any) => void
  onTextEditingStart: (id: string) => void
  onTextEditingChange: (value: string) => void
  onTextEditingFinish: () => void
  onTextEditingCancel: () => void
  onStageClick: (e: any) => void
}

export const ThumbnailCanvas: React.FC<ThumbnailCanvasProps> = ({
  layout,
  backgroundImageBase64,
  fontsLoaded,
  editorState,
  editingElementId,
  editingText,
  editingPosition,
  selectedElement,
  stageRef,
  onSave,
  onCancel,
  onElementSelect,
  onElementTransform,
  onTextEditingStart,
  onTextEditingChange,
  onTextEditingFinish,
  onTextEditingCancel,
  onStageClick,
}) => {
  return (
    <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 버튼 */}
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>
            저장
          </Button>
          <Button onClick={onCancel}>취소</Button>
        </Space>
      </div>

      {/* 캔버스 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1px solid #f0f0f0',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <Stage ref={stageRef} width={1000} height={1000} onClick={onStageClick}>
          <Layer>
            <Grid visible={editorState.showGrid} />

            {backgroundImageBase64 && <BackgroundImage imageUrl={backgroundImageBase64} />}

            {layout.elements.map(element => (
              <EditableText
                key={element.id}
                element={element}
                isSelected={editorState.selectedElementId === element.id}
                isEditing={element.id === editingElementId}
                onSelect={() => onElementSelect(element.id)}
                onTransform={onElementTransform}
                onDoubleClick={() => onTextEditingStart(element.id)}
                fontsLoaded={fontsLoaded}
              />
            ))}
          </Layer>
        </Stage>

        {/* WYSIWYG 텍스트 편집 오버레이 */}
        {editingElementId &&
          (() => {
            const editingElement = layout.elements.find(el => el.id === editingElementId)
            if (!editingElement || !stageRef.current) return null

            const stage = stageRef.current
            const scale = stage.scaleX()

            return (
              <textarea
                value={editingText}
                onChange={e => onTextEditingChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault()
                    onTextEditingFinish()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    onTextEditingCancel()
                  }
                }}
                onBlur={onTextEditingFinish}
                autoFocus
                style={{
                  position: 'absolute',
                  left: editingPosition.x,
                  top: editingPosition.y,
                  width: editingElement.width * scale,
                  height: editingElement.height * scale,
                  zIndex: 1000,
                  fontSize: `${editingElement.fontSize * scale}px`,
                  fontFamily: editingElement.fontFamily,
                  color: editingElement.color,
                  textAlign: editingElement.textAlign,
                  lineHeight: '1.2',
                  border: 'none',
                  background: 'transparent',
                  outline: '1px dashed #1890ff',
                  outlineOffset: '2px',
                  padding: '0',
                  margin: '0',
                  resize: 'none',
                  overflow: 'hidden',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  boxSizing: 'border-box',
                }}
                placeholder="텍스트를 입력하세요..."
              />
            )
          })()}
      </div>
    </div>
  )
}

// 간단한 썸네일 캔버스 (표시 전용, title/subtitle 템플릿 치환)
interface SimpleThumbnailCanvasProps {
  title: string
  subtitle: string
  backgroundImagePath?: string
  width?: number
  height?: number
  onReady?: (getDataUrl: () => string) => void
}

// 기본 썸네일 레이아웃 템플릿
const DEFAULT_THUMBNAIL_LAYOUT = {
  id: 'default',
  backgroundImage: 'background_8453dcbb73d2f44c.png',
  elements: [
    {
      id: 'title',
      text: '{{제목}}',
      x: 10,
      y: 30,
      width: 80,
      height: 20,
      fontSize: 60,
      fontFamily: 'BMDOHYEON',
      color: '#ffffff',
      textAlign: 'center' as const,
      fontWeight: 'bold' as const,
      opacity: 1,
      rotation: 0,
      zIndex: 2,
    },
    {
      id: 'subtitle',
      text: '{{부제목}}',
      x: 10,
      y: 55,
      width: 80,
      height: 15,
      fontSize: 36,
      fontFamily: 'BMDOHYEON',
      color: '#ffffff',
      textAlign: 'center' as const,
      fontWeight: 'normal' as const,
      opacity: 0.9,
      rotation: 0,
      zIndex: 2,
    },
  ],
}

// 배경 이미지 컴포넌트
const SimpleBackgroundImage: React.FC<{
  src: string
  width: number
  height: number
}> = ({ src, width, height }) => {
  const [image] = useImage(src, 'anonymous')

  if (!image) return null

  return <KonvaImage image={image} width={width} height={height} listening={false} />
}

// 텍스트 엘리먼트 컴포넌트
const SimpleTextElement: React.FC<{
  element: any
  width: number
  height: number
}> = ({ element, width, height }) => {
  const x = (element.x / 100) * width
  const y = (element.y / 100) * height
  const elementWidth = (element.width / 100) * width
  const elementHeight = (element.height / 100) * height

  return (
    <Text
      x={x}
      y={y}
      width={elementWidth}
      height={elementHeight}
      text={element.text}
      fontSize={element.fontSize}
      fontFamily={element.fontFamily}
      fill={element.color}
      align={element.textAlign}
      verticalAlign="middle"
      fontStyle={element.fontWeight === 'bold' ? 'bold' : 'normal'}
      opacity={element.opacity}
      rotation={element.rotation}
      listening={false}
    />
  )
}

export const SimpleThumbnailCanvas: React.FC<SimpleThumbnailCanvasProps> = ({
  title,
  subtitle,
  backgroundImagePath,
  width = 1000,
  height = 1000,
  onReady,
}) => {
  const stageRef = React.useRef<Konva.Stage>(null)

  // 템플릿 변수 치환
  const replaceTemplate = (text: string, variables: { [key: string]: string }): string => {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      return variables[key] || match
    })
  }

  // 변수 맵핑
  const variables = {
    제목: title,
    부제목: subtitle,
    title,
    subtitle,
  }

  // 레이아웃 요소를 변수로 치환
  const processedElements = DEFAULT_THUMBNAIL_LAYOUT.elements.map(element => ({
    ...element,
    text: replaceTemplate(element.text, variables),
  }))

  // z-index 순 정렬
  const sortedElements = [...processedElements].sort((a, b) => a.zIndex - b.zIndex)

  // toDataUrl 함수 생성
  const getDataUrl = React.useCallback(() => {
    if (stageRef.current) {
      return stageRef.current.toDataURL({
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 2,
      })
    }
    return ''
  }, [])

  // Stage가 준비되면 onReady 콜백 호출
  React.useEffect(() => {
    if (stageRef.current && onReady) {
      // 약간의 지연 후 준비 완료 (이미지 로딩 대기)
      const timer = setTimeout(() => {
        onReady(getDataUrl)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [onReady, getDataUrl])

  // 배경 이미지 경로 설정
  const finalBackgroundPath = backgroundImagePath || './static/thumbnail/backgrounds/background_8453dcbb73d2f44c.png'

  return (
    <Stage ref={stageRef} width={width} height={height}>
      <Layer>
        {/* 배경 이미지 */}
        <SimpleBackgroundImage src={finalBackgroundPath} width={width} height={height} />

        {/* 텍스트 요소들 */}
        {sortedElements.map(element => (
          <SimpleTextElement key={element.id} element={element} width={width} height={height} />
        ))}
      </Layer>
    </Stage>
  )
}
