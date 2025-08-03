import React, { useState } from 'react'
import { Input, Select, Space } from 'antd'
import { JobStatus, JOB_STATUS } from '@render/api'
import PageContainer from '../../../components/shared/PageContainer'
import JobTypeSelector, { JobTableType } from './JobTypeSelector'
import BlogJobTable from './BlogJobTable'
import CoupangBlogJobTable from './CoupangBlogJobTable'
import TopicJobTable from './TopicJobTable'

const JobTable: React.FC = () => {
  const [selectedType, setSelectedType] = useState<JobTableType>('all')
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field && sorter.order) {
      setSortField(sorter.field)
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
    }
  }

  const handleTypeChange = (type: JobTableType) => {
    setSelectedType(type)
    // 유형 변경 시 필터 초기화
    setStatusFilter('')
    setSearchText('')
  }

  const renderTable = () => {
    const commonProps = {
      statusFilter,
      searchText,
      sortField,
      sortOrder,
      onTableChange: handleTableChange,
    }

    switch (selectedType) {
      case 'blog':
        return <BlogJobTable {...commonProps} />
      case 'coupang':
        return <CoupangBlogJobTable {...commonProps} />
      case 'topic':
        return <TopicJobTable {...commonProps} />
      case 'all':
      default:
        return <BlogJobTable {...commonProps} />
    }
  }

  return (
    <PageContainer title="작업 관리" maxWidth="none">
      {/* 유형 선택기 */}
      <JobTypeSelector selectedType={selectedType} onTypeChange={handleTypeChange} />

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

      {/* 테이블 렌더링 */}
      {renderTable()}
    </PageContainer>
  )
}

export default JobTable
