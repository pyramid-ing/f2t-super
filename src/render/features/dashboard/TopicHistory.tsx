import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Typography, Tag, Input, Select, DatePicker, Modal, message } from 'antd'
import { ReloadOutlined, EyeOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons'
import { getTopicJobs } from '../../api/jobApi'
import { Job } from '../../api/jobApi'
import { TopicResult } from '../../types/topic'
import TopicPreview from '../../components/shared/TopicPreview'
import JobStatusMonitor from '../../components/shared/JobStatusMonitor'

const { Text, Title } = Typography
const { Search } = Input
const { RangePicker } = DatePicker

const TopicHistory: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [monitorModalVisible, setMonitorModalVisible] = useState(false)
  const [monitoringJobId, setMonitoringJobId] = useState<string | null>(null)

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const topicJobs = await getTopicJobs()
      setJobs(topicJobs)
    } catch (error) {
      message.error('토픽 작업 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearchText(value)
  }

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value)
  }

  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
    } else {
      setDateRange(null)
    }
  }

  const handlePreview = (job: Job) => {
    setSelectedJob(job)
    setPreviewModalVisible(true)
  }

  const handleMonitor = (jobId: string) => {
    setMonitoringJobId(jobId)
    setMonitorModalVisible(true)
  }

  const handleDownload = (jobId: string) => {
    const downloadUrl = `/api/topic-job/download-topic-job/${jobId}`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `find-topics-${jobId}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('다운로드가 시작되었습니다.')
  }

  const handleReuse = (job: Job) => {
    if (job.topicJob?.topic) {
      // 토픽 재사용 로직 - 부모 컴포넌트로 전달하거나 새 작업 생성
      message.info(`토픽 "${job.topicJob.topic}"을 재사용할 수 있습니다.`)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'processing':
        return 'processing'
      case 'failed':
        return 'error'
      case 'pending':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료'
      case 'processing':
        return '처리중'
      case 'failed':
        return '실패'
      case 'pending':
        return '대기중'
      default:
        return status
    }
  }

  const filteredJobs = jobs.filter(job => {
    // 검색 필터
    if (searchText && !job.subject.toLowerCase().includes(searchText.toLowerCase())) {
      return false
    }

    // 상태 필터
    if (statusFilter !== 'all' && job.status !== statusFilter) {
      return false
    }

    // 날짜 필터
    if (dateRange) {
      const jobDate = new Date(job.createdAt).toISOString().split('T')[0]
      if (jobDate < dateRange[0] || jobDate > dateRange[1]) {
        return false
      }
    }

    return true
  })

  const columns = [
    {
      title: '작업 ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <Text code style={{ fontSize: '12px' }}>
          {id.substring(0, 8)}...
        </Text>
      ),
    },
    {
      title: '제목',
      dataIndex: 'subject',
      key: 'subject',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '주제',
      dataIndex: ['topicJob', 'topic'],
      key: 'topic',
      render: (topic: string) => <Text>{topic}</Text>,
    },
    {
      title: '개수',
      dataIndex: ['topicJob', 'limit'],
      key: 'limit',
      width: 80,
      render: (limit: number) => <Text>{limit}개</Text>,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>,
    },
    {
      title: '결과',
      dataIndex: ['topicJob', 'result'],
      key: 'result',
      width: 100,
      render: (result: TopicResult[]) => <Text>{result ? result.length : 0}개</Text>,
    },
    {
      title: '생성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => <Text>{new Date(date).toLocaleDateString('ko-KR')}</Text>,
    },
    {
      title: '작업',
      key: 'actions',
      width: 200,
      render: (text: any, record: Job) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
            disabled={record.status !== 'completed'}
          >
            미리보기
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id)}
            disabled={record.status !== 'completed'}
          >
            다운로드
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => handleMonitor(record.id)}>
            상태
          </Button>
          <Button size="small" icon={<CopyOutlined />} onClick={() => handleReuse(record)}>
            재사용
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              📚 토픽 생성 히스토리
            </Title>
            <Tag color="blue">총 {filteredJobs.length}개</Tag>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadJobs}>
            새로고침
          </Button>
        }
      >
        {/* 필터 영역 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Search placeholder="제목으로 검색" allowClear style={{ width: 200 }} onSearch={handleSearch} />
            <Select placeholder="상태 필터" style={{ width: 120 }} value={statusFilter} onChange={handleStatusFilter}>
              <Select.Option value="all">전체</Select.Option>
              <Select.Option value="completed">완료</Select.Option>
              <Select.Option value="processing">처리중</Select.Option>
              <Select.Option value="failed">실패</Select.Option>
              <Select.Option value="pending">대기중</Select.Option>
            </Select>
            <RangePicker placeholder={['시작일', '종료일']} onChange={handleDateRangeChange} />
          </Space>
        </div>

        {/* 작업 목록 테이블 */}
        <Table
          columns={columns}
          dataSource={filteredJobs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}개`,
          }}
          size="small"
        />
      </Card>

      {/* 토픽 미리보기 모달 */}
      <Modal
        title="토픽 생성 결과 미리보기"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        {selectedJob?.topicJob?.result && (
          <TopicPreview
            topics={selectedJob.topicJob.result as TopicResult[]}
            jobId={selectedJob.id}
            onDownload={() => handleDownload(selectedJob.id)}
          />
        )}
      </Modal>

      {/* 작업 상태 모니터링 모달 */}
      <Modal
        title="작업 상태 모니터링"
        open={monitorModalVisible}
        onCancel={() => setMonitorModalVisible(false)}
        footer={null}
        width={600}
      >
        {monitoringJobId && (
          <JobStatusMonitor
            jobId={monitoringJobId}
            onComplete={jobId => {
              message.success('작업이 완료되었습니다!')
              setMonitorModalVisible(false)
              loadJobs() // 목록 새로고침
            }}
            onError={(jobId, error) => {
              message.error(`작업 실패: ${error}`)
              setMonitorModalVisible(false)
              loadJobs() // 목록 새로고침
            }}
          />
        )}
      </Modal>
    </div>
  )
}

export default TopicHistory
