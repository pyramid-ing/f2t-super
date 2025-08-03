import React, { useEffect } from 'react'
import { Button, Form, Input, Divider } from 'antd'
import { useAISettings } from '@render/hooks/useSettings'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

type ValidationResult = {
  isValid: boolean
  message: string
}

type ValidationResults = {
  openai: ValidationResult | null
  gemini: ValidationResult | null
}

export const AISettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { aiSettings, updateAISettings, isLoading, isSaving } = useAISettings()
  const [validating, setValidating] = React.useState(false)
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null)

  useEffect(() => {
    if (aiSettings) {
      form.setFieldsValue({
        geminiApiKey: aiSettings.geminiApiKey || '',
      })
    }
  }, [aiSettings, form])

  const handleSaveSettings = async (values: any) => {
    try {
      await updateAISettings({
        aiProvider: 'gemini',
        geminiApiKey: values.geminiApiKey || '',
      })
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }

  const ValidationStatus: React.FC<{ result: ValidationResult | null }> = ({ result }) => {
    if (!result) return null
    return (
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {result.isValid ? (
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
        ) : (
          <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
        )}
        <span style={{ color: result.isValid ? '#52c41a' : '#ff4d4f' }}>{result.message}</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>AI 설정</h2>
      <Form form={form} layout="vertical" onFinish={handleSaveSettings}>
        <Form.Item
          name="geminiApiKey"
          label="제미나이 API키"
          rules={[
            {
              required: true,
              message: '제미나이 API키를 입력해주세요',
            },
          ]}
        >
          <Input.Password placeholder="제미나이 API키를 입력하세요" />
        </Form.Item>
        <Divider />
        <Button type="primary" htmlType="submit" loading={isSaving}>
          저장
        </Button>
      </Form>
      <ValidationStatus result={validationResult} />
    </div>
  )
}

export default AISettingsForm
