import React, { useState } from 'react'
import { Card, Space, Select } from 'antd'
import PageContainer from '../components/shared/PageContainer'
import AgodaBlogInputForm from '../features/work-management/AgodaBlogInputForm'
import AgodaBlogJobTable from '../features/work-management/JobTable/AgodaBlogJobTable'
import { JobStatus, JOB_STATUS } from '@render/api'

const AgodaBlog: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('')
  const [searchText] = useState('')
  const [sortField, setSortField] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleJobCreated = () => setRefreshKey(prev => prev + 1)

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field && sorter.order) {
      setSortField(sorter.field)
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
    }
  }

  return (
    <PageContainer title="아고다 블로그" maxWidth="none">
      <AgodaBlogInputForm onJobCreated={handleJobCreated} />

      <Card title="아고다 블로그 작업 관리">
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
          </Space>
        </div>

        <AgodaBlogJobTable
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

export default AgodaBlog
