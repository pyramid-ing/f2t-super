import React from 'react'
import { Radio, Space } from 'antd'
import { FileTextOutlined, ShoppingOutlined, BulbOutlined } from '@ant-design/icons'

export type JobTableType = 'all' | 'blog' | 'coupang' | 'topic'

export interface JobTypeSelectorProps {
  selectedType: JobTableType
  onTypeChange: (type: JobTableType) => void
}

const JobTypeSelector: React.FC<JobTypeSelectorProps> = ({ selectedType, onTypeChange }) => {
  const typeOptions = [
    {
      value: 'all',
      label: '전체',
      icon: <FileTextOutlined />,
      description: '모든 작업 유형',
    },
    {
      value: 'blog',
      label: '블로그 포스팅',
      icon: <FileTextOutlined />,
      description: '일반 블로그 포스팅 작업',
    },
    {
      value: 'coupang',
      label: '쿠팡 리뷰',
      icon: <ShoppingOutlined />,
      description: '쿠팡 상품 리뷰 포스팅',
    },
    {
      value: 'topic',
      label: '토픽 생성',
      icon: <BulbOutlined />,
      description: 'AI 토픽 생성 작업',
    },
  ]

  return (
    <div style={{ marginBottom: 16 }}>
      <Radio.Group value={selectedType} onChange={e => onTypeChange(e.target.value)}>
        <Space size="large">
          {typeOptions.map(option => (
            <Radio.Button
              key={option.value}
              value={option.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #d9d9d9',
                backgroundColor: selectedType === option.value ? '#1890ff' : '#fff',
                color: selectedType === option.value ? '#fff' : '#000',
              }}
            >
              {option.icon}
              <div>
                <div style={{ fontWeight: 500 }}>{option.label}</div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>{option.description}</div>
              </div>
            </Radio.Button>
          ))}
        </Space>
      </Radio.Group>
    </div>
  )
}

export default JobTypeSelector
