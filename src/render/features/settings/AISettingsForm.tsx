import React, { useEffect } from 'react'
import { Button, Form, Input, Divider, Select } from 'antd'
import { useAISettings } from '@render/hooks/useSettings'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { getAiModels, type AiModelListResponse } from '@render/api/settingsApi'

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
  const [modelOptions, setModelOptions] = React.useState<AiModelListResponse | null>(null)

  useEffect(() => {
    if (aiSettings) {
      form.setFieldsValue({
        geminiApiKey: aiSettings.geminiApiKey || '',
        aiModel: aiSettings.aiModel || 'gemini-2.5-pro',
      })
    }
  }, [aiSettings, form])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await getAiModels()
        setModelOptions(res)
        const currentModel = form.getFieldValue('aiModel')
        if (!currentModel) {
          form.setFieldsValue({ aiModel: res.defaultModel })
        }
      } catch (error) {
        // 목록 불러오기가 실패해도 기본값으로 동작하게 둠
        setModelOptions({
          defaultModel: 'gemini-2.5-pro',
          models: [
            { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro (권장/기본)' },
            { id: 'gemini-3-flash-preview', label: 'gemini-3-flash-preview (빠름)' },
            { id: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite (저비용)' },
          ],
        })
      }
    })()
  }, [form])

  const handleSaveSettings = async (values: any) => {
    try {
      await updateAISettings({
        aiProvider: 'gemini',
        geminiApiKey: values.geminiApiKey || '',
        aiModel: values.aiModel || 'gemini-2.5-pro',
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
          name="aiModel"
          label="AI 모델"
          rules={[
            {
              required: true,
              message: 'AI 모델을 선택해주세요',
            },
          ]}
        >
          <Select
            loading={isLoading}
            placeholder="모델을 선택하세요"
            options={(modelOptions?.models ?? []).map(m => ({ value: m.id, label: m.label }))}
          />
        </Form.Item>
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
