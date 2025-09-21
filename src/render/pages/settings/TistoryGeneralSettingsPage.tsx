import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import TistoryGeneralSettings from '../../features/settings/TistoryGeneralSettings'

const { Title } = Typography

const TistoryGeneralSettingsPage: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>티스토리 일반 설정</Title>
        <TistoryGeneralSettings />
      </Card>
    </PageContainer>
  )
}

export default TistoryGeneralSettingsPage
