import React from 'react'
import PageContainer from '@render/components/shared/PageContainer'
import IndexingUrlTable from '@render/features/work-management/JobTable/IndexingUrlTable'

const IndexingUrlPage: React.FC = () => {
  return (
    <PageContainer title="URL 기준 보기" maxWidth="">
      <IndexingUrlTable />
    </PageContainer>
  )
}

export default IndexingUrlPage
