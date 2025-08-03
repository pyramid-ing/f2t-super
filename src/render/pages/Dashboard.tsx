import React from 'react'
import PageContainer from '../components/shared/PageContainer'
import DashboardTabs from '../features/dashboard/DashboardTabs'
import JobTable from '@render/features/work-management/JobTable'

const Dashboard: React.FC = () => {
  return (
    <PageContainer title="대시보드" maxWidth="none">
      <DashboardTabs />
      <div style={{ marginTop: '24px' }}>
        <JobTable />
      </div>
    </PageContainer>
  )
}

export default Dashboard
