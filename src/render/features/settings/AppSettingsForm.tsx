import React, { useEffect } from 'react'
import { Switch, Input, Button, Form } from 'antd'
import { useAppSettings } from '@render/hooks/useSettings'

const { TextArea } = Input

const AppSettingsForm: React.FC = () => {
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
        adEnabled: values.adEnabled,
        adScript: values.adScript,
      })
    } catch (error) {
      // 에러는 훅에서 처리됨
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>일반 설정</h2>

      <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>광고 설정</h3>

          <Form.Item name="adEnabled" label="광고 활성화" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            name="adScript"
            label="광고 스크립트"
            tooltip="각 섹션에 삽입될 광고 HTML/JavaScript 코드를 입력하세요"
          >
            <TextArea
              rows={8}
              placeholder={`예시:
<div class="ad-container">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
  <ins class="adsbygoogle"
       style="display:block"
       data-ad-client="ca-pub-xxxxxxxxxx"
       data-ad-slot="xxxxxxxxxx"
       data-ad-format="auto"></ins>
  <script>
       (adsbygoogle = window.adsbygoogle || []).push({});
  </script>
</div>`}
            />
          </Form.Item>
        </div>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isSaving}>
            설정 저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default AppSettingsForm
