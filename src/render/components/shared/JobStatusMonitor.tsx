import React, { useEffect, useState } from 'react'
import { Card, Progress, Tag, Button, Space, Typography, Alert } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, DownloadOutlined } from '@ant-design/icons'
import { getJobStatus } from '../../api/jobApi'

const { Text } = Typography

interface JobStatusMonitorProps {
  jobId: string
  onComplete?: (jobId: string) => void
  onError?: (jobId: string, error: string) => void
}

interface JobStatus {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  resultMsg?: string
  progress?: number
  createdAt: string
  updatedAt: string
}

const JobStatusMonitor: React.FC<JobStatusMonitorProps> = ({ jobId, onComplete, onError }) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(true)

  // Job 상태 폴링
  useEffect(() => {
    const pollJobStatus = async () => {
      try {
        const status = await getJobStatus(jobId)
        setJobStatus(status)
        setLoading(false)

        // 작업이 완료되면 폴링 중지
        if (status.status === 'completed' || status.status === 'failed') {
          setPolling(false)

          if (status.status === 'completed') {
            onComplete?.(jobId)
          } else if (status.status === 'failed') {
            onError?.(jobId, status.resultMsg || '작업이 실패했습니다.')
          }
        }
      } catch (err: any) {
        setError(err.message || '작업 상태를 가져오는데 실패했습니다.')
        setLoading(false)
        setPolling(false)
      }
    }

    // 초기 상태 가져오기
    pollJobStatus()

    // 폴링 설정 (5초마다)
    const interval = setInterval(() => {
      if (polling) {
        pollJobStatus()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [jobId, polling, onComplete, onError])

  const getStatusIcon = () => {
    if (!jobStatus) return <LoadingOutlined />

    switch (jobStatus.status) {
      case 'pending':
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      case 'running':
        return <LoadingOutlined style={{ color: '#52c41a' }} />
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <LoadingOutlined />
    }
  }

  const getStatusColor = () => {
    if (!jobStatus) return 'default'

    switch (jobStatus.status) {
      case 'pending':
        return 'processing'
      case 'running':
        return 'processing'
      case 'completed':
        return 'success'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusText = () => {
    if (!jobStatus) return '로딩 중...'

    switch (jobStatus.status) {
      case 'pending':
        return '대기 중'
      case 'running':
        return '처리 중'
      case 'completed':
        return '완료'
      case 'failed':
        return '실패'
      default:
        return '알 수 없음'
    }
  }

  const handleDownload = () => {
    if (jobStatus?.status === 'completed') {
      const downloadUrl = `/api/topic-job/download-topic-job/${jobId}`
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `find-topics-${jobId}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  if (loading) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <LoadingOutlined />
          <Text>작업 상태를 확인하는 중...</Text>
        </Space>
      </Card>
    )
  }

  if (error) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Alert message="오류 발생" description={error} type="error" showIcon />
      </Card>
    )
  }

  if (!jobStatus) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Alert message="작업을 찾을 수 없습니다" description="작업 ID를 확인해주세요." type="warning" showIcon />
      </Card>
    )
  }

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          {getStatusIcon()}
          <Tag color={getStatusColor()}>{getStatusText()}</Tag>
          <Text type="secondary">작업 ID: {jobId}</Text>
        </Space>

        {(jobStatus.status === 'running' || jobStatus.status === 'pending') && (
          <Progress
            percent={jobStatus.progress || 0}
            status={jobStatus.status === 'running' ? 'active' : 'normal'}
            strokeColor={jobStatus.status === 'running' ? '#52c41a' : '#1890ff'}
          />
        )}

        {jobStatus.resultMsg && <Text type="secondary">{jobStatus.resultMsg}</Text>}

        {jobStatus.status === 'completed' && (
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
            결과 다운로드
          </Button>
        )}

        {jobStatus.status === 'failed' && (
          <Alert
            message="작업 실패"
            description={jobStatus.resultMsg || '알 수 없는 오류가 발생했습니다.'}
            type="error"
            showIcon
          />
        )}
      </Space>
    </Card>
  )
}

export default JobStatusMonitor
