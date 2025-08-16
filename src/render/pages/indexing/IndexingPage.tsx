import React from 'react'
import PageContainer from '@render/components/shared/PageContainer'
import { IndexingDashboard } from '@render/features/indexing'

const IndexingPage: React.FC = () => {
  return (
    <PageContainer title="" maxWidth="">
      <IndexingDashboard />
    </PageContainer>
  )
}

export default IndexingPage
