import React from 'react'
import { Card, Typography } from 'antd'
import PageContainer from '../../components/shared/PageContainer'
import WordPressSettingsForm from '../../features/settings/WordPressSettingsForm'

const { Title } = Typography

const WordPressSettings: React.FC = () => {
  return (
    <PageContainer>
      <Card>
        <Title level={2}>워드프레스 설정</Title>
        <WordPressSettingsForm />
      </Card>
    </PageContainer>
  )
}

export default WordPressSettings
