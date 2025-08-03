import React from 'react'
import { Card, Button, Select, ColorPicker, Space, Typography, Input, InputNumber, Form, Upload } from 'antd'
import { AppstoreOutlined, PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { ThumbnailLayout, EditorState, TextElement } from '../../types/thumbnail'

const { Option } = Select
const { Text } = Typography
const { TextArea } = Input

interface ThumbnailEditorSidebarProps {
  form: any
  layout: ThumbnailLayout
  backgroundImageBase64: string
  editorState: EditorState
  selectedElement: TextElement | null
  onAddTextElement: () => void
  onDeleteElement: (id: string) => void
  onTransformElement: (id: string, attrs: any) => void
  onBackgroundUpload: (file: File) => void
  onGridToggle: () => void
}

export const ThumbnailEditorSidebar: React.FC<ThumbnailEditorSidebarProps> = ({
  form,
  layout,
  backgroundImageBase64,
  editorState,
  selectedElement,
  onAddTextElement,
  onDeleteElement,
  onTransformElement,
  onBackgroundUpload,
  onGridToggle,
}) => {
  const fontFamilyOptions = [
    { value: 'BMDOHYEON', label: '배민 도현체' },
    { value: 'NanumGothic', label: '나눔고딕' },
    { value: 'NanumSquare', label: '나눔스퀘어' },
  ]

  return (
    <div style={{ width: '300px', padding: '16px', borderRight: '1px solid #f0f0f0', overflowY: 'auto' }}>
      {/* 레이아웃 정보 */}
      <Card title="레이아웃 정보" size="small" className="mb-4">
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="레이아웃 이름"
            rules={[{ required: true, message: '레이아웃 이름을 입력해주세요' }]}
          >
            <Input placeholder="레이아웃 이름을 입력하세요" />
          </Form.Item>

          <Form.Item name="description" label="설명">
            <TextArea placeholder="레이아웃 설명을 입력하세요" rows={3} />
          </Form.Item>
        </Form>
      </Card>

      {/* 배경 설정 */}
      <Card title="배경 설정" size="small" className="mb-4">
        <Upload
          accept=".png,.jpg,.jpeg"
          showUploadList={false}
          beforeUpload={file => {
            onBackgroundUpload(file)
            return false
          }}
        >
          <Button icon={<UploadOutlined />} block>
            배경 이미지 업로드
          </Button>
        </Upload>

        {backgroundImageBase64 && (
          <div className="mt-2">
            <img src={backgroundImageBase64} alt="배경 이미지" style={{ width: '100%', borderRadius: '4px' }} />
          </div>
        )}
      </Card>

      {/* 요소 추가 */}
      <Card title="요소 추가" size="small" className="mb-4">
        <Button icon={<PlusOutlined />} onClick={onAddTextElement} block>
          텍스트 추가
        </Button>
      </Card>

      {/* 템플릿 안내 */}
      <Card title="템플릿 사용법" size="small" className="mb-4">
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>사용 가능한 템플릿:</strong>
          </div>
          <div style={{ marginBottom: '4px' }}>
            • <code>{'{{제목}}'}</code> - 제목으로 교체
          </div>
          <div style={{ marginBottom: '4px' }}>
            • <code>{'{{부제목}}'}</code> - 부제목으로 교체
          </div>
          <div style={{ marginBottom: '8px' }}>• 자유롭게 조합하여 사용 가능</div>
          <div style={{ fontSize: '11px', color: '#999' }}>
            <strong>예시:</strong>
            <br />
            <code>{'{{제목}} - {{부제목}}'}</code>
            <br />
            <code>{'메인: {{제목}}'}</code>
          </div>
        </div>
      </Card>

      {/* 요소 속성 */}
      {selectedElement && (
        <Card title="요소 속성" size="small" className="mb-4">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>텍스트</Text>
              <Input
                value={selectedElement.text}
                onChange={e => onTransformElement(selectedElement.id, { text: e.target.value })}
                placeholder="예: {{제목}}, {{부제목}} 등 템플릿 사용 가능"
              />
            </div>

            <div>
              <Text strong>폰트 크기</Text>
              <InputNumber
                min={12}
                max={200}
                step={1}
                precision={0}
                value={selectedElement.fontSize}
                onChange={value => onTransformElement(selectedElement.id, { fontSize: value || 12 })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <Text strong>텍스트 박스 폭</Text>
              <InputNumber
                min={50}
                max={900}
                step={10}
                precision={0}
                value={selectedElement.width}
                onChange={value => onTransformElement(selectedElement.id, { width: value || 50 })}
                style={{ width: '100%' }}
                addonAfter="px"
              />
            </div>

            <div>
              <Text strong>텍스트 박스 높이</Text>
              <InputNumber
                min={20}
                max={800}
                step={10}
                precision={0}
                value={selectedElement.height}
                onChange={value => onTransformElement(selectedElement.id, { height: value || 20 })}
                style={{ width: '100%' }}
                addonAfter="px"
              />
            </div>

            <div>
              <Text strong>폰트 패밀리</Text>
              <Select
                value={selectedElement.fontFamily}
                onChange={value => onTransformElement(selectedElement.id, { fontFamily: value })}
                style={{ width: '100%' }}
              >
                {fontFamilyOptions.map(font => (
                  <Option key={font.value} value={font.value}>
                    {font.label}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <Text strong>색상</Text>
              <ColorPicker
                value={selectedElement.color}
                onChange={(color, hex) => onTransformElement(selectedElement.id, { color: hex })}
              />
            </div>

            <div>
              <Text strong>정렬</Text>
              <Select
                value={selectedElement.textAlign}
                onChange={value => onTransformElement(selectedElement.id, { textAlign: value })}
                style={{ width: '100%' }}
              >
                <Option value="left">왼쪽</Option>
                <Option value="center">가운데</Option>
                <Option value="right">오른쪽</Option>
              </Select>
            </div>

            <Button danger icon={<DeleteOutlined />} onClick={() => onDeleteElement(selectedElement.id)} block>
              요소 삭제
            </Button>
          </Space>
        </Card>
      )}

      {/* 에디터 설정 */}
      <Card title="에디터 설정" size="small" className="mb-4">
        <Button
          icon={<AppstoreOutlined />}
          onClick={onGridToggle}
          type={editorState.showGrid ? 'primary' : 'default'}
          block
        >
          격자 {editorState.showGrid ? '숨기기' : '보기'}
        </Button>
      </Card>

      {/* 키보드 단축키 안내 */}
      <Card title="키보드 단축키" size="small">
        <div style={{ fontSize: '11px', color: '#666' }}>
          <div style={{ marginBottom: '4px' }}>
            <strong>기본 조작:</strong>
          </div>
          <div style={{ marginBottom: '2px' }}>• 더블클릭: 텍스트 편집</div>
          <div style={{ marginBottom: '2px' }}>• 드래그: 텍스트 박스 크기 조정</div>
          <div style={{ marginBottom: '2px' }}>• Del/Backspace: 삭제</div>
          <div style={{ marginBottom: '2px' }}>• 방향키: 이동 (Shift+방향키: 1px씩)</div>
          <div style={{ marginBottom: '4px' }}>• Esc: 선택 해제</div>

          <div style={{ marginBottom: '4px' }}>
            <strong>편집:</strong>
          </div>
          <div style={{ marginBottom: '2px' }}>• Ctrl+C: 복사</div>
          <div style={{ marginBottom: '2px' }}>• Ctrl+V: 붙여넣기</div>
          <div style={{ marginBottom: '2px' }}>• Ctrl+D: 복제</div>
          <div style={{ marginBottom: '2px' }}>• Ctrl+Z: 실행취소</div>
          <div style={{ marginBottom: '2px' }}>• Ctrl+Y: 다시실행</div>

          <div style={{ marginBottom: '4px', marginTop: '8px' }}>
            <strong>텍스트 편집:</strong>
          </div>
          <div style={{ marginBottom: '2px' }}>• 더블클릭: 실제 위치에서 WYSIWYG 편집</div>
          <div style={{ marginBottom: '2px' }}>• Ctrl+Enter: 편집 완료</div>
          <div style={{ marginBottom: '2px' }}>• Esc: 편집 취소</div>

          <div style={{ marginBottom: '4px', marginTop: '8px' }}>
            <strong>텍스트 박스:</strong>
          </div>
          <div style={{ marginBottom: '2px' }}>• 텍스트는 박스 폭에 맞춰 자동 줄바꿈</div>
          <div style={{ marginBottom: '2px' }}>• 박스 크기 조정 시 폰트 크기 유지</div>
          <div style={{ marginBottom: '2px' }}>• 속성 패널에서 정확한 크기 입력 가능</div>
        </div>
      </Card>
    </div>
  )
}
