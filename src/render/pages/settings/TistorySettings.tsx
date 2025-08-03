import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'

const { Title } = Typography

const TistorySettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>티스토리 설정</Title>
        <p>티스토리 계정 설정이 여기에 표시됩니다.</p>
      </Card>
    </PageContainer>
  )
}

export default TistorySettings
