import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import GoogleBlogSettingsForm from '../../features/settings/GoogleBlogSettingsForm'

const { Title } = Typography

const GoogleBlogSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>구글 블로그</Title>
        <GoogleBlogSettingsForm />
      </Card>
    </PageContainer>
  )
}

export default GoogleBlogSettings
