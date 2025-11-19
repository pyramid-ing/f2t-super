import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import AppGeneralSettingsForm from '../../features/settings/AppGeneralSettingsForm'

const { Title } = Typography

const CommonSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>공통설정</Title>
        <AppGeneralSettingsForm />
      </Card>
    </PageContainer>
  )
}

export default CommonSettings
