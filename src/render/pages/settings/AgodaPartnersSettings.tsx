import React from 'react'
import { Card } from 'antd'
import AgodaPartnersSettingsForm from '@render/features/settings/AgodaPartnersSettingsForm'

const AgodaPartnersSettings: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card title="아고다 파트너스 설정" style={{ marginBottom: 16 }}>
        <AgodaPartnersSettingsForm />
      </Card>
    </div>
  )
}

export default AgodaPartnersSettings
