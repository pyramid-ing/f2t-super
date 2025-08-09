import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import ImageGenerationSettingsForm from '../../features/settings/ImageGenerationSettingsForm'

const { Title } = Typography

const ImageGenerationPage: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>이미지 생성 방식</Title>
        <ImageGenerationSettingsForm />
      </Card>
    </PageContainer>
  )
}

export default ImageGenerationPage
