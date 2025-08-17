import React, { useState } from 'react'
import { message, Input, Button, Space, Card, Typography, Alert } from 'antd'
import { createBulkIndexJob } from '@render/api/jobApi'
import { useIndexingTasks } from '@render/features/indexing'
import IndexingJobTable from '@render/features/work-management/JobTable/IndexingJobTable'

const { Title, Text } = Typography

export const IndexingDashboard: React.FC = () => {
  const { tasks, loading, selectedTask, onTaskSelect, onTaskClose, onTaskRetry, onTaskDelete, refresh } =
    useIndexingTasks()
  const [urlInput, setUrlInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUrlInput(e.target.value)
  }

  const handleSubmit = async () => {
    const urls = urlInput
      .split(/\r?\n/)
      .map(url => url.trim())
      .filter(Boolean)
    if (urls.length === 0) {
      message.warning('URL을 한 개 이상 입력하세요.')
      return
    }
    setSubmitting(true)
    try {
      const res = await createBulkIndexJob(urls)
      if (res?.success) {
        message.success(res.message || '인덱싱 요청이 일괄 처리되었습니다.')
      } else {
        const detail = typeof res?.message === 'string' ? res.message : ''
        message.warning(detail || '모든 URL이 이미 인덱싱되어 새로 생성할 작업이 없습니다.')
      }
      setUrlInput('')
      refresh()
    } catch (err: any) {
      // 서버에서 상세 결과를 반환하는 경우 메시지 처리
      const serverMsg = err?.response?.data?.message || err?.response?.data?.errorMessage
      message.error('인덱싱 요청 중 오류가 발생했습니다: ' + (serverMsg || err?.message || ''))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestIndexing = async (task: any) => {
    try {
      await createBulkIndexJob([task.url])
      message.success('인덱싱 요청이 재등록되었습니다.')
      refresh()
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || err?.response?.data?.errorMessage
      message.error('인덱싱 요청 중 오류가 발생했습니다: ' + (serverMsg || err?.message || ''))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 일일 제한 안내 */}
      <Alert
        message="일일 인덱싱 제한 안내"
        description={
          <Space direction="vertical" size="small">
            <Text>각 검색 엔진의 정책입니다 (저희 프로그램 문제가 아닙니다):</Text>
            <Text>• 네이버: 50개/일</Text>
            <Text>• 구글: 200개/일</Text>
            <Text>• 빙: 100개/일</Text>
          </Space>
        }
        type="info"
        showIcon
      />

      {/* URL 입력 섹션 */}
      <Card title="새 인덱싱 요청" className="shadow-sm" style={{ marginBottom: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input.TextArea
            rows={4}
            value={urlInput}
            onChange={handleUrlInputChange}
            placeholder="여러 개의 URL을 줄 단위로 입력하세요."
            style={{ fontSize: '14px' }}
          />
          <Button type="primary" onClick={handleSubmit} loading={submitting} size="large">
            인덱싱 요청
          </Button>
        </Space>
      </Card>

      {/* 작업 목록 섹션 */}
      <Card title="인덱싱 작업 목록" className="shadow-sm">
        <IndexingJobTable />
      </Card>
    </div>
  )
}
