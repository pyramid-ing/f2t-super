import React from 'react'
import { Form, Input, Switch, Alert, Space, Typography } from 'antd'
import { Site } from '@render/api/siteConfigApi'

const { Text } = Typography

interface IndexingSettingsProps {
  site: Site
}

const IndexingSettings: React.FC<IndexingSettingsProps> = ({ site }) => {
  return (
    <div>
      <Alert
        message="일일 인덱싱 제한 안내"
        description={
          <Space direction="vertical" size="small">
            <Text>각 검색 엔진의 정책입니다 (저희 프로그램 문제가 아닙니다):</Text>
            <Text>• 네이버: 50개/일</Text>
            <Text>• 구글: 200개/일</Text>
            <Text>• 빙: 100개/일</Text>
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form.Item name={['indexing', 'use']} valuePropName="checked" label="자동 인덱싱 사용">
        <Switch />
      </Form.Item>

      <Form.Item
        name={['indexing', 'schedule']}
        label="인덱싱 스케줄 (Cron 표현식)"
        rules={[{ required: true, message: 'Cron 표현식을 입력해주세요' }]}
      >
        <Input placeholder="0 0 * * *" />
      </Form.Item>
    </div>
  )
}

export default IndexingSettings
