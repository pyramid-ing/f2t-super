import { Input, Select, Space, Tabs } from 'antd'
import React, { useState } from 'react'
import TopicExtraction from './TopicExtraction'
import Posting from './Posting'
import TopicJobTable from '../work-management/JobTable/TopicJobTable'
import InfoBlogJobTable from 'src/render/features/work-management/JobTable/InfoBlogJobTable'
import { JOB_STATUS, JobStatus } from '@render/api'

const InfoBlogTabs: React.FC = () => {
  // 토픽 탭 상태
  const [topicStatusFilter, setTopicStatusFilter] = useState<JobStatus | ''>('')
  const [topicSearchText, setTopicSearchText] = useState('')
  const [topicSortField, setTopicSortField] = useState('updatedAt')
  const [topicSortOrder, setTopicSortOrder] = useState<'asc' | 'desc'>('desc')

  // 포스팅 탭 상태
  const [postStatusFilter, setPostStatusFilter] = useState<JobStatus | ''>('')
  const [postSearchText, setPostSearchText] = useState('')
  const [postSortField, setPostSortField] = useState('updatedAt')
  const [postSortOrder, setPostSortOrder] = useState<'asc' | 'desc'>('desc')

  const renderFilter = (
    status: JobStatus | '',
    setStatus: (v: JobStatus | '') => void,
    search: string,
    setSearch: (v: string) => void,
  ) => (
    <div style={{ margin: '12px 0' }}>
      <Space size="middle" wrap>
        <Space>
          <span>상태 필터:</span>
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: '전체' },
              { value: JOB_STATUS.REQUEST, label: '등록요청' },
              { value: JOB_STATUS.PENDING, label: '등록대기' },
              { value: JOB_STATUS.PROCESSING, label: '처리중' },
              { value: JOB_STATUS.COMPLETED, label: '완료' },
              { value: JOB_STATUS.FAILED, label: '실패' },
            ]}
            style={{ width: 120 }}
          />
        </Space>
        <Space>
          <span>검색:</span>
          <Input.Search
            placeholder="제목, 내용, 결과 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>
      </Space>
    </div>
  )

  return (
    <Tabs
      defaultActiveKey="topic-extraction"
      size="large"
      items={[
        {
          key: 'topic-extraction',
          label: '🔍 주제 추출',
          children: (
            <div>
              <TopicExtraction />
              {renderFilter(topicStatusFilter, setTopicStatusFilter, topicSearchText, setTopicSearchText)}
              <TopicJobTable
                statusFilter={topicStatusFilter}
                searchText={topicSearchText}
                sortField={topicSortField}
                sortOrder={topicSortOrder}
                onTableChange={(pagination, filters, sorter) => {
                  if (sorter.field && sorter.order) {
                    setTopicSortField(sorter.field)
                    setTopicSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
                  }
                }}
              />
            </div>
          ),
        },
        {
          key: 'posting',
          label: '📝 포스팅',
          children: (
            <div>
              <Posting />
              {renderFilter(postStatusFilter, setPostStatusFilter, postSearchText, setPostSearchText)}
              <InfoBlogJobTable
                statusFilter={postStatusFilter}
                searchText={postSearchText}
                sortField={postSortField}
                sortOrder={postSortOrder}
                onTableChange={(pagination, filters, sorter) => {
                  if (sorter.field && sorter.order) {
                    setPostSortField(sorter.field)
                    setPostSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
                  }
                }}
              />
            </div>
          ),
        },
      ]}
    />
  )
}

export default InfoBlogTabs
