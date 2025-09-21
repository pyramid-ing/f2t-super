import React, { useEffect } from 'react'
import { Switch, Button, Form } from 'antd'
import { useAppSettings } from '@render/hooks/useSettings'

const TistoryGeneralSettings: React.FC = () => {
  const [form] = Form.useForm()
  const { appSettings, updateAppSettings, isLoading, isSaving } = useAppSettings()

  // 설정 로드 시 폼 초기화
  useEffect(() => {
    form.setFieldsValue(appSettings)
  }, [appSettings, form])

  // 설정 저장
  const handleSave = async (values: any) => {
    try {
      await updateAppSettings({
        tistoryHeadless: values.tistoryHeadless,
      })
    } catch (error) {
      // 에러는 훅에서 처리됨
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>티스토리 일반 설정</h3>

      <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
        <Form.Item
          name="tistoryHeadless"
          label="창숨김 모드"
          valuePropName="checked"
          tooltip="창숨김 모드를 사용하면 브라우저 창이 보이지 않고 백그라운드에서 실행됩니다"
        >
          <Switch checkedChildren="창숨김" unCheckedChildren="창보임" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isSaving}>
            설정 저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default TistoryGeneralSettings
