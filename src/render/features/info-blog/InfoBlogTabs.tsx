import { Input, Select, Tabs, Form } from 'antd'
import React, { useState } from 'react'
import TopicExtraction from './TopicExtraction'
import Posting from './Posting'
import TopicJobTable from '../work-management/JobTable/TopicJobTable'
import { JOB_STATUS } from '@render/api'
import InfoBlogJobTable from '@render/features/work-management/JobTable/InfoBlogJobTable'

const InfoBlogTabs: React.FC = () => {
  // 토픽 탭 상태
  const [topicForm] = Form.useForm()
  const [topicSortField, setTopicSortField] = useState('updatedAt')
  const [topicSortOrder, setTopicSortOrder] = useState<'asc' | 'desc'>('desc')
  const [topicRefreshKey, setTopicRefreshKey] = useState(0)

  // 포스팅 탭 상태
  const [postForm] = Form.useForm()
  const [postSortField, setPostSortField] = useState('updatedAt')
  const [postSortOrder, setPostSortOrder] = useState<'asc' | 'desc'>('desc')
  const [postRefreshKey, setPostRefreshKey] = useState(0)

  const renderFilter = (form: any, onSearch: (values: any) => void) => (
    <div style={{ margin: '12px 0' }}>
      <Form
        form={form}
        layout="inline"
        initialValues={{
          statusFilter: '',
          searchText: '',
        }}
        onFinish={onSearch}
        style={{ display: 'flex', alignItems: 'center', gap: 16 }}
      >
        <Form.Item name="statusFilter" style={{ margin: 0 }}>
          <Select
            placeholder="상태 필터"
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
        </Form.Item>
        <Form.Item name="searchText" style={{ margin: 0 }}>
          <Input.Search
            placeholder="제목, 내용, 결과 검색"
            style={{ width: 300 }}
            allowClear
            enterButton
            onSearch={() => form.submit()}
          />
        </Form.Item>
      </Form>
    </div>
  )

  return (
    <Tabs
      defaultActiveKey="topic-extraction"
      size="large"
      items={[
        {
          key: 'topic-job-extraction',
          label: '🔍 주제 추출',
          children: (
            <div>
              <TopicExtraction />
              {renderFilter(topicForm, values => {
                // 검색 버튼 클릭 시 테이블 새로고침
                console.log('Topic form submitted with values:', values)
                setTopicRefreshKey(prev => prev + 1)
              })}
              <TopicJobTable
                key={topicRefreshKey}
                form={topicForm}
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
              {renderFilter(postForm, values => {
                // 검색 버튼 클릭 시 테이블 새로고침
                console.log('Post form submitted with values:', values)
                setPostRefreshKey(prev => prev + 1)
              })}
              <InfoBlogJobTable
                key={postRefreshKey}
                form={postForm}
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
