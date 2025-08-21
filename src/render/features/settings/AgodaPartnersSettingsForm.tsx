import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message } from 'antd'
import { useSettings } from '@render/hooks/useSettings'

interface AgodaPartnerSettings {
  apiKey: string
}

const AgodaPartnersSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { settings, updatePartialSettings } = useSettings()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        apiKey: settings.agoda?.apiKey || '',
      })
    }
  }, [settings, form])

  const handleSubmit = async (values: AgodaPartnerSettings) => {
    setLoading(true)
    try {
      await updatePartialSettings({
        agoda: { apiKey: values.apiKey },
      })
      message.success('아고다 파트너스 설정이 저장되었습니다.')
    } catch (error) {
      message.error('설정 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="아고다 파트너스 설정" style={{ marginBottom: 16 }}>
      <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
        <Form.Item label="API 키" name="apiKey" rules={[{ required: true, message: 'API 키를 입력해주세요.' }]}>
          <Input.Password placeholder="예) 1947015:87645ff4-8d6d-495b-a91a-8e60d09a34f4 (CID:API_KEY)" allowClear />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            설정 저장
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default AgodaPartnersSettingsForm
