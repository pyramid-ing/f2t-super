export interface TextElement {
  id: string
  text: string // {{제목}}, {{부제목}} 등의 템플릿 문법 지원
  x: number // 퍼센트 (0-100)
  y: number // 퍼센트 (0-100)
  width: number // 퍼센트 (0-100)
  height: number // 퍼센트 (0-100)
  fontSize: number
  fontFamily: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  fontWeight: 'normal' | 'bold'
  opacity: number // 0-1
  rotation: number // 각도
  zIndex: number
}

export interface ThumbnailLayout {
  id: string
  backgroundImage: string // 배경 이미지 파일명
  elements: TextElement[]
  createdAt: string
  updatedAt: string
}

export interface ThumbnailTemplate {
  id: string
  name: string
  description: string
  elements: Omit<TextElement, 'text'>[] // 텍스트 내용은 제외
}

export interface TemplateVariables {
  [key: string]: string
}

export interface EditorState {
  selectedElementId: string | null
  isDragging: boolean
  isResizing: boolean
  showGrid: boolean
  snapToGrid: boolean
}

export interface EditorHistory {
  past: ThumbnailLayout[]
  present: ThumbnailLayout
  future: ThumbnailLayout[]
}

// 드래그 앤 드롭 이벤트 타입
export interface DragEvent {
  elementId: string
  startX: number
  startY: number
  currentX: number
  currentY: number
}

// 리사이즈 이벤트 타입
export interface ResizeEvent {
  elementId: string
  startWidth: number
  startHeight: number
  currentWidth: number
  currentHeight: number
  corner: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w'
}
