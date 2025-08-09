import React from 'react'
import { Card, Typography, Tabs } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import AISettingsForm from '../../features/settings/AISettingsForm'
import AppSettingsForm from '../../features/settings/AppSettingsForm'
import LinkSettingsForm from '../../features/settings/LinkSettingsForm'
import ImageGenerationSettingsForm from '../../features/settings/ImageGenerationSettingsForm'

const { Title } = Typography

const CommonSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>공통설정</Title>
        <Tabs
          defaultActiveKey="ai"
          items={[
            {
              key: 'ai',
              label: 'AI 설정',
              children: <AISettingsForm />,
            },
            {
              key: 'app',
              label: '앱 설정',
              children: <AppSettingsForm />,
            },
            {
              key: 'image-generation',
              label: '이미지 생성 방식',
              children: <ImageGenerationSettingsForm />,
            },
            {
              key: 'link',
              label: '링크 설정',
              children: <LinkSettingsForm />,
            },
          ]}
        />
      </Card>
    </PageContainer>
  )
}

export default CommonSettings
