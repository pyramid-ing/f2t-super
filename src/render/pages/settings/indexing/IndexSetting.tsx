import React, { useEffect, useState } from 'react'
import { Typography, Card, Tabs, Form, Button, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getGlobalSettings, updateGlobalSettings } from '@render/api/siteConfigApi'
import PageContainer from '@render/components/shared/PageContainer'
import AiSettings from '@render/features/settings/indexing/AiSettings'

const { Title } = Typography

const SettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const [globalSettings, setGlobalSettings] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [globalSettingsForm] = Form.useForm()

  useEffect(() => {
    fetchGlobalSettings()
  }, [])

  const fetchGlobalSettings = async () => {
    try {
      const data = await getGlobalSettings()
      setGlobalSettings(data.data)
      // 전역 설정 폼 초기화
      if (data.data) {
        globalSettingsForm.setFieldsValue(data.data)
      }
    } catch (error) {
      console.error('Failed to load global settings:', error)
    }
  }

  const handleSaveGlobalSettings = async (values: any) => {
    try {
      setSavingSettings(true)
      await updateGlobalSettings(values)
      message.success('전역 설정이 저장되었습니다.')
      await fetchGlobalSettings() // 설정 다시 로드
    } catch (error) {
      console.error('Failed to save global settings:', error)
      message.error('전역 설정 저장에 실패했습니다.')
    } finally {
      setSavingSettings(false)
    }
  }

  const globalItems = [
    {
      key: 'ai',
      label: 'AI',
      children: <AiSettings settings={globalSettings} />,
    },
  ]

  return (
    <PageContainer title="전역 설정">
      <div className="space-y-6">
        <Card>
          <Form
            form={globalSettingsForm}
            onFinish={handleSaveGlobalSettings}
            disabled={savingSettings}
            layout="vertical"
          >
            <Tabs items={globalItems} type="card" />
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={savingSettings}>
                전역 설정 저장
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </PageContainer>
  )
}

export default SettingsPage
