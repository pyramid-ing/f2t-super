import React from 'react'
import { Card, Typography, Tabs } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import GoogleBlogSettingsForm from '../../features/settings/GoogleBlogSettingsForm'
import ImageSettingsForm from '../../features/settings/ImageSettingsForm'

const { Title } = Typography

const BloggerSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>블로그스팟 설정</Title>
        <Tabs
          defaultActiveKey="google-blog"
          items={[
            {
              key: 'google-blog',
              label: '구글 블로그',
              children: <GoogleBlogSettingsForm />,
            },
            {
              key: 'image',
              label: '이미지 설정',
              children: <ImageSettingsForm />,
            },
          ]}
        />
      </Card>
    </PageContainer>
  )
}

export default BloggerSettings
