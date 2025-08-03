import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { useSettings } from '@render/hooks/useSettings'

interface CoupangPartnerSettings {
  apiKey: string
  secretKey: string
}

const CoupangPartnersSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { settings, updatePartialSettings } = useSettings()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        apiKey: settings.coupangPartner?.apiKey || '',
        secretKey: settings.coupangPartner?.secretKey || '',
      })
    }
  }, [settings, form])

  const handleSubmit = async (values: CoupangPartnerSettings) => {
    setLoading(true)
    try {
      await updatePartialSettings({
        coupangPartner: {
          apiKey: values.apiKey,
          secretKey: values.secretKey,
        },
      })
      message.success('쿠팡 파트너스 설정이 저장되었습니다.')
    } catch (error) {
      message.error('설정 저장에 실패했습니다.')
      console.error('CoupangPartners settings save error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="쿠팡 파트너스 설정" style={{ marginBottom: 16 }}>
      <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
        <Form.Item label="API 키" name="apiKey" rules={[{ required: true, message: 'API 키를 입력해주세요.' }]}>
          <Input.Password placeholder="쿠팡 파트너스 API 키를 입력하세요" allowClear />
        </Form.Item>

        <Form.Item
          label="시크릿 키"
          name="secretKey"
          rules={[{ required: true, message: '시크릿 키를 입력해주세요.' }]}
        >
          <Input.Password placeholder="쿠팡 파트너스 시크릿 키를 입력하세요" allowClear />
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

export default CoupangPartnersSettingsForm
