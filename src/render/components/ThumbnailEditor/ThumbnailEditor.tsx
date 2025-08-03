import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Form, message } from 'antd'
import { TextElement, ThumbnailLayout, EditorState } from '../../types/thumbnail'
import { thumbnailApi } from '../../api'
import { ThumbnailEditorSidebar } from './ThumbnailEditorSidebar'
import { ThumbnailCanvas } from './ThumbnailCanvas'
import Konva from 'konva'

// 웹 폰트 로딩을 위한 CSS 스타일
const fontStyles = `
  @import url('http://fonts.googleapis.com/earlyaccess/nanumgothic.css');
  @import url('https://cdn.rawgit.com/moonspam/NanumSquare/master/nanumsquare.css');
  
  @font-face {
    font-family: 'BMDOHYEON';
    src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMDOHYEON.woff') format('woff');
    font-weight: normal;
    font-style: normal;
  }
`

interface ThumbnailEditorProps {
  initialLayout?: ThumbnailLayout
  initialName?: string
  initialDescription?: string
  onSave: (layout: ThumbnailLayout, name: string, description?: string) => void
  onCancel: () => void
  isCreatingNew?: boolean
}

const ThumbnailEditor: React.FC<ThumbnailEditorProps> = ({
  initialLayout,
  initialName,
  initialDescription,
  onSave,
  onCancel,
  isCreatingNew = false,
}) => {
  const [form] = Form.useForm()
  const stageRef = useRef<Konva.Stage>(null)

  const createDefaultLayout = (): ThumbnailLayout => ({
    id: Date.now().toString(),
    backgroundImage: '',
    elements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const [layout, setLayout] = useState<ThumbnailLayout>(initialLayout || createDefaultLayout())
  const [backgroundImageBase64, setBackgroundImageBase64] = useState<string>('')
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false)
  const [editorState, setEditorState] = useState<EditorState>({
    selectedElementId: null,
    isDragging: false,
    isResizing: false,
    showGrid: true,
    snapToGrid: false,
  })

  // 텍스트 인라인 편집 상태
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState<string>('')
  const [editingPosition, setEditingPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // 클립보드 상태
  const [clipboardElement, setClipboardElement] = useState<TextElement | null>(null)

  // 히스토리 상태 (Undo/Redo)
  const [history, setHistory] = useState<ThumbnailLayout[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  const fontFamilyOptions = [
    { value: 'BMDOHYEON', label: '배민 도현체' },
    { value: 'NanumGothic', label: '나눔고딕' },
    { value: 'NanumSquare', label: '나눔스퀘어' },
  ]

  // 폰트 로딩
  useEffect(() => {
    const loadFonts = async () => {
      try {
        // CSS 스타일 추가
        if (!document.getElementById('thumbnail-fonts')) {
          const style = document.createElement('style')
          style.id = 'thumbnail-fonts'
          style.innerHTML = fontStyles
          document.head.appendChild(style)
        }

        // 폰트 로딩 대기
        if ('fonts' in document) {
          await Promise.all([
            document.fonts.load('1em BMDOHYEON'),
            document.fonts.load('1em NanumGothic'),
            document.fonts.load('1em NanumSquare'),
          ])
        }

        // 폰트 로딩 완료 후 잠시 대기
        setTimeout(() => {
          setFontsLoaded(true)
          console.log('폰트 로딩 완료')
        }, 1000)
      } catch (error) {
        console.error('폰트 로딩 실패:', error)
        setFontsLoaded(true) // 실패해도 계속 진행
      }
    }

    loadFonts()
  }, [])

  // 초기값 설정
  useEffect(() => {
    if (initialLayout) {
      setLayout(initialLayout)
      // 히스토리에 초기 레이아웃 추가
      setHistory([initialLayout])
      setHistoryIndex(0)
    }

    if (initialName) {
      form.setFieldValue('name', initialName)
    }

    if (initialDescription) {
      form.setFieldValue('description', initialDescription)
    }

    if (initialLayout?.backgroundImage) {
      loadBackgroundImage(initialLayout.backgroundImage)
    }
  }, [initialLayout, initialName, initialDescription, form])

  // 배경 이미지 로딩
  const loadBackgroundImage = async (backgroundImage: string) => {
    try {
      const response = await thumbnailApi.getBackgroundImage(backgroundImage)
      if (response.success && response.base64) {
        setBackgroundImageBase64(response.base64)
      }
    } catch (error) {
      console.error('배경 이미지 로딩 실패:', error)
    }
  }

  // 히스토리 추가
  const addToHistory = useCallback(
    (newLayout: ThumbnailLayout) => {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1)
        newHistory.push(newLayout)
        return newHistory
      })
      setHistoryIndex(prev => prev + 1)
    },
    [historyIndex],
  )

  // 선택된 요소 가져오기
  const selectedElement = layout.elements.find(el => el.id === editorState.selectedElementId) || null

  // 요소 선택
  const selectElement = useCallback((id: string | null) => {
    setEditorState(prev => ({ ...prev, selectedElementId: id }))
  }, [])

  // 텍스트 요소 추가
  const addTextElement = useCallback(() => {
    const newElement: TextElement = {
      id: Date.now().toString(),
      text: '새 텍스트',
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      fontSize: 24,
      fontFamily: 'NanumGothic',
      color: '#000000',
      opacity: 1,
      textAlign: 'left',
      fontWeight: 'normal',
      rotation: 0,
      zIndex: layout.elements.length + 1,
    }

    const newLayout = {
      ...layout,
      elements: [...layout.elements, newElement],
      updatedAt: new Date().toISOString(),
    }

    setLayout(newLayout)
    addToHistory(newLayout)
    selectElement(newElement.id)
  }, [layout, addToHistory, selectElement])

  // 요소 변형
  const transformElement = useCallback(
    (id: string, attrs: any) => {
      const newLayout = {
        ...layout,
        elements: layout.elements.map(el => (el.id === id ? { ...el, ...attrs } : el)),
        updatedAt: new Date().toISOString(),
      }

      setLayout(newLayout)
      addToHistory(newLayout)
    },
    [layout, addToHistory],
  )

  // 요소 삭제
  const deleteElement = useCallback(
    (id: string) => {
      const newLayout = {
        ...layout,
        elements: layout.elements.filter(el => el.id !== id),
        updatedAt: new Date().toISOString(),
      }

      setLayout(newLayout)
      addToHistory(newLayout)
      selectElement(null)
    },
    [layout, addToHistory, selectElement],
  )

  // 텍스트 편집 시작
  const startTextEditing = useCallback(
    (elementId: string) => {
      const element = layout.elements.find(el => el.id === elementId)
      if (!element || !stageRef.current) return

      const stage = stageRef.current
      const container = stage.container()
      const containerRect = container.getBoundingClientRect()
      const scale = stage.scaleX()

      const x = containerRect.left + element.x * scale
      const y = containerRect.top + element.y * scale

      setEditingElementId(elementId)
      setEditingText(element.text)
      setEditingPosition({ x, y })
    },
    [layout.elements],
  )

  // 텍스트 편집 완료
  const finishTextEditing = useCallback(() => {
    if (editingElementId) {
      transformElement(editingElementId, { text: editingText })
      setEditingElementId(null)
      setEditingText('')
    }
  }, [editingElementId, editingText, transformElement])

  // 텍스트 편집 취소
  const cancelTextEditing = useCallback(() => {
    setEditingElementId(null)
    setEditingText('')
  }, [])

  // 배경 이미지 업로드
  const handleBackgroundUpload = async (file: File) => {
    try {
      const result = await thumbnailApi.uploadBackgroundImage(file)
      if (result.success && result.fileName) {
        setLayout(prev => ({
          ...prev,
          backgroundImage: result.fileName,
        }))
        await loadBackgroundImage(result.fileName)
        message.success('배경 이미지가 업로드되었습니다.')
      } else {
        message.error(result.error || '배경 이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('배경 이미지 업로드 실패:', error)
      message.error('배경 이미지 업로드 중 오류가 발생했습니다.')
    }
  }

  // 격자 토글
  const toggleGrid = useCallback(() => {
    setEditorState(prev => ({ ...prev, showGrid: !prev.showGrid }))
  }, [])

  // 저장 처리
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const updatedLayout = {
        ...layout,
        updatedAt: new Date().toISOString(),
      }
      onSave(updatedLayout, values.name, values.description)
    } catch (error) {
      console.error('폼 검증 실패:', error)
    }
  }

  // 캔버스 클릭 처리
  const handleStageClick = (e: any) => {
    // 편집 중이면 편집 완료
    if (editingElementId) {
      finishTextEditing()
      return
    }

    // 텍스트가 아닌 다른 요소를 클릭했을 때 선택 해제
    const targetType = e.target.nodeType || e.target.constructor.name
    if (targetType !== 'Text') {
      selectElement(null)
    }
  }

  return (
    <div style={{ display: 'flex', height: '80vh' }}>
      <ThumbnailEditorSidebar
        form={form}
        layout={layout}
        backgroundImageBase64={backgroundImageBase64}
        editorState={editorState}
        selectedElement={selectedElement}
        onAddTextElement={addTextElement}
        onDeleteElement={deleteElement}
        onTransformElement={transformElement}
        onBackgroundUpload={handleBackgroundUpload}
        onGridToggle={toggleGrid}
      />

      <ThumbnailCanvas
        layout={layout}
        backgroundImageBase64={backgroundImageBase64}
        fontsLoaded={fontsLoaded}
        editorState={editorState}
        editingElementId={editingElementId}
        editingText={editingText}
        editingPosition={editingPosition}
        selectedElement={selectedElement}
        stageRef={stageRef}
        onSave={handleSave}
        onCancel={onCancel}
        onElementSelect={selectElement}
        onElementTransform={transformElement}
        onTextEditingStart={startTextEditing}
        onTextEditingChange={setEditingText}
        onTextEditingFinish={finishTextEditing}
        onTextEditingCancel={cancelTextEditing}
        onStageClick={handleStageClick}
      />
    </div>
  )
}

export default ThumbnailEditor
