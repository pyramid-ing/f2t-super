import React from 'react'
import { Form, Input, Typography, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { Site } from '@render/api/siteConfigApi'
import { extractDomainFromUrl } from '@render/utils/urlUtils'

const { Text } = Typography

interface GeneralSettingsProps {
  site: Site
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ site }) => {
  const handleSiteUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    if (url) {
      const domain = extractDomainFromUrl(url)
      if (domain) {
        // Form 인스턴스를 통해 도메인 필드 업데이트
        const form = Form.useFormInstance()
        form.setFieldsValue({ general: { domain } })
      }
    }
  }

  return (
    <div>
      <Form.Item
        name={['general', 'name']}
        label={
          <span>
            사이트 이름
            <Tooltip title="관리용 이름으로, 원하는 이름을 자유롭게 입력하세요.">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
            </Tooltip>
          </span>
        }
        rules={[{ required: true, message: '사이트 이름을 입력해주세요' }]}
        extra="관리용 이름으로, 원하는 이름을 자유롭게 입력하세요."
      >
        <Input placeholder="예: 내 블로그" />
      </Form.Item>

      <Form.Item
        name={['general', 'domain']}
        label={
          <span>
            도메인
            <Tooltip title="사이트 URL을 입력하면 자동으로 추출됩니다.">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
            </Tooltip>
          </span>
        }
        rules={[{ required: true, message: '도메인을 입력해주세요' }]}
        extra="사이트 URL을 입력하면 자동으로 추출됩니다."
      >
        <Text
          style={{
            display: 'block',
            padding: '4px 11px',
            minHeight: '32px',
            lineHeight: '24px',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            backgroundColor: '#f5f5f5',
          }}
        >
          {Form.useWatch(['general', 'domain'], Form.useFormInstance()) || '도메인이 자동으로 추출됩니다'}
        </Text>
      </Form.Item>

      <Form.Item
        name={['general', 'siteUrl']}
        label={
          <span>
            사이트 URL
            <Tooltip title="전체 URL을 입력해주세요 (예: https://example.com)">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
            </Tooltip>
          </span>
        }
        rules={[
          { required: true, message: '사이트 URL을 입력해주세요' },
          { type: 'url', message: '올바른 URL 형식을 입력해주세요' },
        ]}
        extra="전체 URL을 입력해주세요 (예: https://example.com)"
      >
        <Input placeholder="예: https://example.com" onChange={handleSiteUrlChange} />
      </Form.Item>
    </div>
  )
}

export default GeneralSettings
