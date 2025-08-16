import React from 'react'
import { Form, Select, Switch, Spin, Alert, Typography } from 'antd'
import { Site } from '@render/api/siteConfigApi'
import { getAllNaverAccounts, NaverAccount } from '@render/api/naverAccountApi'

const { Text } = Typography

interface NaverSettingsProps {
  site: Site
}

const NaverSettings: React.FC<NaverSettingsProps> = ({ site }) => {
  const [accounts, setAccounts] = React.useState<NaverAccount[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const data = await getAllNaverAccounts()
      setAccounts(data || [])
    } catch (error) {
      console.error('네이버 계정 목록을 불러오는데 실패했습니다:', error)
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Alert
        message="네이버 정책: 50개/일 (저희 프로그램 문제가 아닙니다)"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form.Item name={['naver', 'use']} valuePropName="checked" label="네이버 인덱싱 사용">
        <Switch />
      </Form.Item>

      <Form.Item name={['naver', 'selectedNaverAccountId']} label="네이버 계정">
        <Select
          placeholder="네이버 계정을 선택하세요"
          loading={loading}
          notFoundContent={loading ? <Spin size="small" /> : '등록된 계정이 없습니다'}
        >
          {accounts.map(account => (
            <Select.Option key={account.id} value={account.id}>
              {account.name} ({account.naverId})
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name={['naver', 'headless']} valuePropName="checked" label="창 숨김">
        <Switch />
      </Form.Item>
    </>
  )
}

export default NaverSettings
