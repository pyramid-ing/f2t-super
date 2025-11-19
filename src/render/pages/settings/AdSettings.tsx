import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import AdSettingsForm from '../../features/settings/AdSettingsForm'

const { Title } = Typography

const AdSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>광고 설정</Title>
        <AdSettingsForm />
      </Card>
    </PageContainer>
  )
}

export default AdSettings
