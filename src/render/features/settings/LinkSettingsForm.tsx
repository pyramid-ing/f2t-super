import React, { useEffect } from 'react'
import { Form, Switch, Button } from 'antd'
import { useAppSettings } from '@render/hooks/useSettings'

const LinkSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { appSettings, updateAppSettings, isLoading, isSaving } = useAppSettings()

  useEffect(() => {
    form.setFieldsValue({
      linkEnabled: appSettings.linkEnabled || false,
      youtubeEnabled: appSettings.youtubeEnabled || false,
    })
  }, [appSettings, form])

  const handleSave = async () => {
    try {
      const values = form.getFieldsValue()
      await updateAppSettings({
        linkEnabled: values.linkEnabled,
        youtubeEnabled: values.youtubeEnabled,
      })
    } catch (error) {
      // 에러는 훅에서 처리됨
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>링크 설정</h2>
      <Form form={form} layout="vertical">
        <Form.Item name="linkEnabled" label="일반 링크 생성 활성화" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="youtubeEnabled" label="유튜브 링크 생성 활성화" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item>
          <Button type="primary" onClick={handleSave} loading={isSaving}>
            설정 저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default LinkSettingsForm
