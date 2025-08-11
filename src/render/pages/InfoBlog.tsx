import React from 'react'
import PageContainer from '../components/shared/PageContainer'
import InfoBlogTabs from '@render/features/info-blog/InfoBlogTabs'

const InfoBlog: React.FC = () => {
  return (
    <PageContainer title="정보 블로그" maxWidth="none">
      <InfoBlogTabs />
    </PageContainer>
  )
}

export default InfoBlog
