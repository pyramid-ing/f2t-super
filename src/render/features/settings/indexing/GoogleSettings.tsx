import React from 'react'
import { Form, Input, Switch, Alert } from 'antd'
import { Site } from '@render/api/siteConfigApi'

interface GoogleSettingsProps {
  site: Site
}

const GoogleSettings: React.FC<GoogleSettingsProps> = ({ site }) => {
  return (
    <>
      <Alert
        message="구글 정책: 200개/일 (저희 프로그램 문제가 아닙니다)"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form.Item name={['google', 'use']} valuePropName="checked" label="구글 인덱싱 사용">
        <Switch />
      </Form.Item>

      <Form.Item name={['google', 'serviceAccountJson']} label="서비스 계정 JSON">
        <Input.TextArea rows={10} placeholder="서비스 계정 JSON을 입력하세요" />
      </Form.Item>
    </>
  )
}

export default GoogleSettings
