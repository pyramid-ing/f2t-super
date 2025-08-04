import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import TistorySettingsForm from '../../features/settings/TistorySettingsForm'

const { Title } = Typography

const TistorySettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>티스토리 설정</Title>
        <TistorySettingsForm />
      </Card>
    </PageContainer>
  )
}

export default TistorySettings
