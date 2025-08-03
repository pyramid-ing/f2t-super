import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'

const { Title } = Typography

const AdSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>광고 설정</Title>
        <p>광고 관련 설정이 여기에 표시됩니다.</p>
      </Card>
    </PageContainer>
  )
}

export default AdSettings
