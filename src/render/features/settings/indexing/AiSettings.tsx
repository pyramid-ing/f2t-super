import React from 'react'
import { Form, Input, Switch, Alert } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

interface AiSettingsProps {
  settings: {
    ai?: {
      use: boolean
      openaiApiKey: string
    }
  }
}

const AiSettings: React.FC<AiSettingsProps> = ({ settings }) => {
  return (
    <>
      <Alert
        message="AI 설정"
        description="OpenAI API 키를 설정하여 캡챠 자동 해제 기능을 사용할 수 있습니다."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Form.Item name={['ai', 'use']} valuePropName="checked" label="AI 캡챠 해제 사용">
        <Switch />
      </Form.Item>

      <Form.Item name={['ai', 'openaiApiKey']} label="OpenAI API 키">
        <Input.Password placeholder="sk-..." />
      </Form.Item>
    </>
  )
}

export default AiSettings
