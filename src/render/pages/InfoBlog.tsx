import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../components/shared/PageContainer'

const { Title } = Typography

const InfoBlog: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>정보 블로그</Title>
        <p>정보 블로그 관련 기능이 여기에 표시됩니다.</p>
      </Card>
    </PageContainer>
  )
}

export default InfoBlog
