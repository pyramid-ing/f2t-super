import React from 'react'
import { Tabs } from 'antd'
import { AISettingsForm } from './AISettingsForm'
import AppSettingsForm from './AppSettingsForm'
import GoogleBlogSettingsForm from './GoogleBlogSettingsForm'
import ImageSettingsForm from './ImageSettingsForm'
import LinkSettingsForm from './LinkSettingsForm'

const SettingsTabs: React.FC = () => {
  const items = [
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
      key: 'google-blog',
      label: 'Google 블로그',
      children: <GoogleBlogSettingsForm />,
    },
    {
      key: 'image',
      label: '이미지 설정',
      children: <ImageSettingsForm />,
    },
    {
      key: 'link',
      label: '링크 설정',
      children: <LinkSettingsForm />,
    },
  ]

  return <Tabs defaultActiveKey="ai" items={items} />
}

export default SettingsTabs
