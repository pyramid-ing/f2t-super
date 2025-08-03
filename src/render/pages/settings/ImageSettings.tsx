import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import ImageSettingsForm from '../../features/settings/ImageSettingsForm'

const { Title } = Typography

const ImageSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>이미지 설정</Title>
        <ImageSettingsForm />
      </Card>
    </PageContainer>
  )
}

export default ImageSettings
