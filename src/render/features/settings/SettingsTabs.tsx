import React from 'react'
import { Tabs } from 'antd'
import { AISettingsForm } from './AISettingsForm'
import AppSettingsForm from './AppSettingsForm'
import GoogleBlogSettingsForm from './GoogleBlogSettingsForm'
import ImageSettingsForm from './ImageSettingsForm'
import LinkSettingsForm from './LinkSettingsForm'
import CoupangPartnersSettingsForm from './CoupangPartnersSettingsForm'
import TistorySettingsForm from './TistorySettingsForm'
import WordPressSettingsForm from './WordPressSettingsForm'

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
      key: 'tistory',
      label: '티스토리',
      children: <TistorySettingsForm />,
    },
    {
      key: 'wordpress',
      label: '워드프레스',
      children: <WordPressSettingsForm />,
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
    {
      key: 'coupang-partners',
      label: '쿠팡 파트너스',
      children: <CoupangPartnersSettingsForm />,
    },
  ]

  return <Tabs defaultActiveKey="ai" items={items} />
}

export default SettingsTabs
