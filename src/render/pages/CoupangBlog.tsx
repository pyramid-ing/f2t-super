import React, { useState } from 'react'
import { Card, Typography, Collapse, Input, Select, Space } from 'antd'
import PageContainer from '../components/shared/PageContainer'
import CoupangBlogInputForm from '../features/work-management/CoupangBlogInputForm'
import CoupangBlogJobTable from '../features/work-management/JobTable/CoupangBlogJobTable'
import { JobStatus, JOB_STATUS } from '@render/api'

const { Title } = Typography
const { Panel } = Collapse

const CoupangBlog: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleJobCreated = () => {
    // 작업이 생성되면 테이블을 새로고침
    setRefreshKey(prev => prev + 1)
  }

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field && sorter.order) {
      setSortField(sorter.field)
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
    }
  }

  return (
    <PageContainer>
      {/* 입력 폼 */}
      <CoupangBlogInputForm onJobCreated={handleJobCreated} />

      {/* 작업 테이블 */}
      <Card title="쿠팡 블로그 작업 관리">
        {/* 필터 영역 */}
        <div style={{ marginBottom: 12 }}>
          <Space size="middle" wrap>
            <Space>
              <span>상태 필터:</span>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
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
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
            </Space>
          </Space>
        </div>

        <CoupangBlogJobTable
          key={refreshKey}
          statusFilter={statusFilter}
          searchText={searchText}
          sortField={sortField}
          sortOrder={sortOrder}
          onTableChange={handleTableChange}
        />
      </Card>
    </PageContainer>
  )
}

export default CoupangBlog
