import React from 'react'
import PageContainer from '../components/shared/PageContainer'
import InfoBlogTabs from '@render/features/info-blog/InfoBlogTabs'
import { Select, Typography } from 'antd'
import { useAppSettings } from '@render/hooks/useSettings'

const InfoBlog: React.FC = () => {
  const { appSettings, updateAppSettings, isSaving } = useAppSettings()

  const language = appSettings.infoBlogLanguage || 'ko'

  const languageOptions = [
    { value: 'ko', label: '한국어 (ko)' },
    { value: 'en', label: 'English (en)' },
    { value: 'ja', label: '日本語 (ja)' },
    { value: 'zh', label: '中文 (zh)' },
    { value: 'vi', label: 'Tiếng Việt (vi)' },
    { value: 'th', label: 'ไทย (th)' },
    { value: 'id', label: 'Bahasa Indonesia (id)' },
    { value: 'ms', label: 'Bahasa Melayu (ms)' },
    { value: 'tl', label: 'Filipino (tl)' },
    { value: 'hi', label: 'हिन्दी (hi)' },
    { value: 'bn', label: 'বাংলা (bn)' },
    { value: 'ur', label: 'اردو (ur)' },
    { value: 'ar', label: 'العربية (ar)' },
    { value: 'tr', label: 'Türkçe (tr)' },
    { value: 'de', label: 'Deutsch (de)' },
    { value: 'fr', label: 'Français (fr)' },
    { value: 'es', label: 'Español (es)' },
    { value: 'pt', label: 'Português (pt)' },
    { value: 'ru', label: 'Русский (ru)' },
    { value: 'it', label: 'Italiano (it)' },
  ] as const

  return (
    <PageContainer title="정보 블로그" maxWidth="none">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <Typography.Text strong>언어</Typography.Text>
        <Select
          style={{ width: 260 }}
          showSearch
          optionFilterProp="label"
          value={language}
          options={languageOptions as any}
          onChange={async value => {
            try {
              await updateAppSettings({ infoBlogLanguage: value })
            } catch {
              // 에러 메시지는 훅에서 처리
            }
          }}
          disabled={isSaving}
        />
      </div>
      <InfoBlogTabs />
    </PageContainer>
  )
}

export default InfoBlog
