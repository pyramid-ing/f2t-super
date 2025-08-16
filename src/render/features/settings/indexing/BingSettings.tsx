import React from 'react'
import { Form, Input, Switch, Alert } from 'antd'
import { Site } from '@render/api/siteConfigApi'

interface BingSettingsProps {
  site: Site
}

const BingSettings: React.FC<BingSettingsProps> = ({ site }) => {
  return (
    <>
      <Alert
        message="빙 정책: 100개/일 (저희 프로그램 문제가 아닙니다)"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form.Item name={['bing', 'use']} valuePropName="checked" label="빙 인덱싱 사용">
        <Switch />
      </Form.Item>

      <Form.Item name={['bing', 'apiKey']} label="API 키">
        <Input.Password placeholder="API 키를 입력하세요" />
      </Form.Item>
    </>
  )
}

export default BingSettings
