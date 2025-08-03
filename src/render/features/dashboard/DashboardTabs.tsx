import { Tabs } from 'antd'
import React from 'react'
import TopicExtraction from './TopicExtraction'
import Posting from './Posting'

const DashboardTabs: React.FC = () => {
  return (
    <Tabs
      defaultActiveKey="topic-extraction"
      size="large"
      items={[
        {
          key: 'topic-extraction',
          label: '주제 추출',
          children: <TopicExtraction />,
        },
        {
          key: 'posting',
          label: '포스팅',
          children: <Posting />,
        },
      ]}
    />
  )
}

export default DashboardTabs
