import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'

const { Title } = Typography

const WordPressSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>워드프레스 설정</Title>
        <p>워드프레스 계정 설정이 여기에 표시됩니다.</p>
      </Card>
    </PageContainer>
  )
}

export default WordPressSettings
