import { Button, Form, Input, Radio, Switch } from 'antd'
import React, { useEffect } from 'react'
import { useImageSettings } from '@render/hooks/useSettings'

const ImageGenerationSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { imageSettings, updateImageSettings, isLoading, isSaving } = useImageSettings()

  useEffect(() => {
    form.setFieldsValue({
      imageType: imageSettings.imageType || 'pixabay',
      pixabayApiKey: imageSettings.pixabayApiKey || '',
      thumbnailEnabled: imageSettings.thumbnailEnabled ?? true,
    })
  }, [imageSettings, form])

  const handleSaveSettings = async (values: any) => {
    await updateImageSettings({
      imageType: values.imageType,
      pixabayApiKey: values.pixabayApiKey,
      thumbnailEnabled: values.thumbnailEnabled,
    })
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>이미지 생성 방식</h2>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveSettings}
        initialValues={{
          imageType: 'pixabay',
          pixabayApiKey: '',
          thumbnailEnabled: true,
        }}
        style={{ maxWidth: 800 }}
      >
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 20, marginBottom: 32 }}>
          <h3 style={{ marginTop: 0 }}>이미지 생성 방식</h3>
          <Form.Item
            name="imageType"
            label="이미지 생성 방식"
            tooltip="포스트에 삽입할 이미지를 생성하는 방식을 선택하세요."
          >
            <Radio.Group>
              <Radio value="ai">AI 생성</Radio>
              <Radio value="pixabay">Pixabay 검색</Radio>
              <Radio value="none">사용안함</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="pixabayApiKey"
            label="픽사베이 API키"
            tooltip="픽사베이에서 이미지를 검색하기 위한 API 키를 입력하세요."
          >
            <Input type="password" placeholder="픽사베이 API키 입력" disabled={isLoading} />
          </Form.Item>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 20, marginBottom: 32 }}>
          <h3 style={{ marginTop: 0 }}>썸네일 설정</h3>
          <Form.Item
            name="thumbnailEnabled"
            label="썸네일 생성"
            tooltip="포스트 발행 시 썸네일 이미지를 자동으로 생성할지 여부를 설정합니다."
            valuePropName="checked"
          >
            <Switch checkedChildren="활성화" unCheckedChildren="비활성화" disabled={isLoading} />
          </Form.Item>
        </div>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isSaving} disabled={isLoading}>
            설정 저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default ImageGenerationSettingsForm
