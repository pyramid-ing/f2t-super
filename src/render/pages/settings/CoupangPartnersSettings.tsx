import React from 'react'
import { Card } from 'antd'
import CoupangPartnersSettingsForm from '../../features/settings/CoupangPartnersSettingsForm'

const CoupangPartnersSettings: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card title="쿠팡 파트너스 설정" style={{ marginBottom: 16 }}>
        <CoupangPartnersSettingsForm />
      </Card>
    </div>
  )
}

export default CoupangPartnersSettings
