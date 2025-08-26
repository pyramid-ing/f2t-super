import React from 'react'
import PageContainer from '@render/components/shared/PageContainer'
import { useParams } from 'react-router-dom'
import IndexingUrlTable from '@render/features/work-management/JobTable/IndexingUrlTable'

const IndexingJobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>()

  return (
    <PageContainer title="인덱싱 상세" maxWidth="">
      <IndexingUrlTable jobId={jobId} />
    </PageContainer>
  )
}

export default IndexingJobDetailPage
