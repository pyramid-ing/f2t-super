import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import AppSettingsForm from '../../features/settings/AppSettingsForm'

const { Title } = Typography

const AdSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>광고 설정</Title>
        <AppSettingsForm />
      </Card>
    </PageContainer>
  )
}

export default AdSettings
