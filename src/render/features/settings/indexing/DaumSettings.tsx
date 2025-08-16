import React from 'react'
import { Form, Input, Switch } from 'antd'
import { Site } from '@render/api/siteConfigApi'

interface DaumSettingsProps {
  site: Site
}

const DaumSettings: React.FC<DaumSettingsProps> = ({ site }) => {
  return (
    <>
      <Form.Item name={['daum', 'use']} valuePropName="checked" label="다음 인덱싱 사용">
        <Switch />
      </Form.Item>

      <Form.Item name={['daum', 'siteUrl']} label="사이트 URL">
        <Input placeholder="https://example.com" />
      </Form.Item>

      <Form.Item name={['daum', 'password']} label="비밀번호">
        <Input.Password />
      </Form.Item>

      <Form.Item name={['daum', 'headless']} valuePropName="checked" label="창 숨김">
        <Switch />
      </Form.Item>
    </>
  )
}

export default DaumSettings
