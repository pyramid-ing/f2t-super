import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../components/shared/PageContainer'

const { Title, Paragraph } = Typography

const Home: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>환영합니다 👋</Title>
        <Paragraph></Paragraph>
      </Card>
    </PageContainer>
  )
}

export default Home
