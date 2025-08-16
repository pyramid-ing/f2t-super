import { Button, Input, InputNumber, Select, Switch } from 'antd'
import React from 'react'
import styled from 'styled-components'

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const FormItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const Label = styled.label`
  min-width: 120px;
`

interface SettingsFormProps {
  apiKey: string
  intervalSec: number
  useAi: boolean
  aiProvider: string
  answerMode: 'auto' | 'manual'
  hideBrowser: boolean
  onApiKeyChange: (value: string) => void
  onIntervalChange: (value: number) => void
  onUseAiChange: (value: boolean) => void
  onAiProviderChange: (value: string) => void
  onAnswerModeChange: (value: 'auto' | 'manual') => void
  onHideBrowserChange: (value: boolean) => void
  onSave: () => void
}

const SettingsForm: React.FC<SettingsFormProps> = ({
  apiKey,
  intervalSec,
  useAi,
  aiProvider,
  answerMode,
  hideBrowser,
  onApiKeyChange,
  onIntervalChange,
  onUseAiChange,
  onAiProviderChange,
  onAnswerModeChange,
  onHideBrowserChange,
  onSave,
}) => {
  return (
    <FormContainer>
      AI 설정
      <FormItem>
        <Label>답변 모드:</Label>
        <Select
          style={{ width: 200 }}
          value={answerMode}
          onChange={onAnswerModeChange}
          options={[
            { value: 'auto', label: '자동 답변' },
            { value: 'manual', label: '수동 답변' },
          ]}
        />
      </FormItem>
      <FormItem>
        <Label>AI 공급자:</Label>
        <Select
          style={{ width: 200 }}
          value={aiProvider}
          onChange={onAiProviderChange}
          options={[
            { value: 'openai', label: 'OpenAI' },
            { value: 'claude', label: 'Anthropic Claude' },
          ]}
        />
      </FormItem>
      <FormItem>
        <Label>API Key:</Label>
        <Input
          value={apiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          placeholder="sk-xxxx or claude key"
          style={{ flex: 1 }}
        />
      </FormItem>
      <FormItem>
        <Label>모니터링 주기:</Label>
        <InputNumber
          min={10}
          max={3600}
          value={intervalSec}
          onChange={val => onIntervalChange(val || 10)}
          addonAfter="초"
        />
      </FormItem>
      <FormItem>
        <Label>AI 답변 사용:</Label>
        <Switch checked={useAi} onChange={onUseAiChange} />
      </FormItem>
      <FormItem>
        <Label>브라우저 숨김:</Label>
        <Switch checked={hideBrowser} onChange={onHideBrowserChange} />
      </FormItem>
      <Button type="primary" onClick={onSave}>
        저장
      </Button>
    </FormContainer>
  )
}

export default SettingsForm
