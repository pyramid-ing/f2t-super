import React from 'react'
import { Form, Switch } from 'antd'
import { useAppSettings } from '@render/hooks/useSettings'

const AppGeneralSettingsForm: React.FC = () => {
  const { appSettings, updateAppSettings, isSaving } = useAppSettings()

  const handleDebugToggle = async (checked: boolean) => {
    try {
      await updateAppSettings({
        debugBrowserEnabled: checked,
      })
    } catch {
      // 에러는 훅에서 처리됨
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>일반 설정</h2>

      <Form layout="vertical" style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>디버그 브라우저</h3>

          <Form.Item label="브라우저 디버그 모드 (창 보이기)">
            <Switch
              checked={Boolean(appSettings.debugBrowserEnabled)}
              loading={isSaving}
              onChange={handleDebugToggle}
            />
          </Form.Item>

          <div style={{ fontSize: '12px', color: '#888' }}>
            Playwright를 사용하는 네이버/다음/쿠팡/아고다 작업 시 크롬 창을 표시하여 동작을 눈으로 확인할 수 있습니다.
          </div>
        </div>
      </Form>
    </div>
  )
}

export default AppGeneralSettingsForm
