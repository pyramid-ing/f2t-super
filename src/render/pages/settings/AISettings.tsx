import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import AISettingsForm from '../../features/settings/AISettingsForm'

const { Title } = Typography

const AISettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>AI 설정</Title>
        <AISettingsForm />
      </Card>
    </PageContainer>
  )
}

export default AISettings
