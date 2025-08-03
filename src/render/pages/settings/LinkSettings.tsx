import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import LinkSettingsForm from '../../features/settings/LinkSettingsForm'

const { Title } = Typography

const LinkSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>링크 설정</Title>
        <LinkSettingsForm />
      </Card>
    </PageContainer>
  )
}

export default LinkSettings
