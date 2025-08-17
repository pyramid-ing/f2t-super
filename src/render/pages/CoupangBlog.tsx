import React, { useState } from 'react'
import { Card, Typography, Collapse } from 'antd'
import PageContainer from '../components/shared/PageContainer'
import CoupangBlogInputForm from '../features/work-management/CoupangBlogInputForm'
import CoupangBlogJobTable from '../features/work-management/JobTable/CoupangBlogJobTable'

const { Title } = Typography
const { Panel } = Collapse

const CoupangBlog: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleJobCreated = () => {
    // 작업이 생성되면 테이블을 새로고침
    setRefreshKey(prev => prev + 1)
  }

  return (
    <PageContainer>
      {/* 입력 폼 */}
      <CoupangBlogInputForm onJobCreated={handleJobCreated} />

      {/* 작업 테이블 */}
      <Card title="쿠팡 블로그 작업 관리">
        <CoupangBlogJobTable
          key={refreshKey}
          statusFilter=""
          searchText=""
          sortField="updatedAt"
          sortOrder="desc"
          onTableChange={() => {}}
        />
      </Card>
    </PageContainer>
  )
}

export default CoupangBlog
