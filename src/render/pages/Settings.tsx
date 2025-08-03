import React from 'react'
import { Tabs } from 'antd'
import PageContainer from '@render/components/shared/PageContainer'
import SettingsTabs from '@render/features/settings/SettingsTabs'

const { TabPane } = Tabs

const Settings: React.FC = () => {
  return (
    <PageContainer>
      <SettingsTabs />
    </PageContainer>
  )
}

export default Settings
