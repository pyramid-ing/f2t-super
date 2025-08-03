import {
  Button,
  Input,
  message,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Checkbox,
  DatePicker,
  InputNumber,
  Divider,
} from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import {
  deleteJob,
  downloadFindTopicsResult,
  downloadJobFile,
  getJobLogs,
  getLatestJobLog,
  Job,
  JobLog,
  JobStatus,
  JobType,
  retryJob,
  retryJobs,
  deleteJobs,
  requestToPending,
  pendingToRequest,
} from '../../api'
import { getJobs, JOB_STATUS, JOB_TYPE, JOB_STATUS_LABEL } from '../../api'
import PageContainer from '../../components/shared/PageContainer'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import locale from 'antd/es/date-picker/locale/ko_KR'
import { api } from '../../api'

const ResultCell = styled.div`
  max-width: 100%;
  word-break: break-word;
  line-height: 1.5;

  .result-text {
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 4px;
  }

  .success-text {
    color: #16a34a;
    font-weight: 500;
  }

  .error-text {
    color: #dc2626;
    font-weight: 500;
  }

  .pending-text {
    color: #2563eb;
    font-weight: 500;
  }

  .processing-text {
    color: #d97706;
    font-weight: 500;
  }

  .hover-hint {
    cursor: help;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background-color 0.2s;

    &:hover {
      background-color: rgba(59, 130, 246, 0.1);
    }
  }
`

const PopoverContent = styled.div`
  max-width: 400px;

  .popover-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 16px;
    font-weight: 600;

    &.success {
      color: #16a34a;
    }

    &.error {
      color: #dc2626;
    }

    &.pending {
      color: #2563eb;
    }

    &.processing {
      color: #d97706;
    }
  }

  .popover-message {
    background: #f8fafc;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: #475569;
    border-left: 3px solid #e2e8f0;
    white-space: pre-wrap;
    word-break: break-word;

    &.success {
      background: #f0fdf4;
      border-left-color: #16a34a;
      color: #15803d;
    }

    &.error {
      background: #fef2f2;
      border-left-color: #dc2626;
      color: #b91c1c;
    }

    &.pending {
      background: #eff6ff;
      border-left-color: #2563eb;
      color: #1e40af;
    }

    &.processing {
      background: #fffbeb;
      border-left-color: #d97706;
      color: #a16207;
    }
  }

  .result-url {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;

    a {
      color: #1890ff;
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  }
`

const StyledTable = styled(Table)`
  .ant-table-tbody > tr.row-completed {
    background-color: #f6ffed;

    &:hover > td {
      background-color: #e6f7e0 !important;
    }
  }

  .ant-table-tbody > tr.row-failed {
    background-color: #fff2f0;

    &:hover > td {
      background-color: #ffe6e2 !important;
    }
  }

  .ant-table-tbody > tr.row-processing {
    background-color: #fff7e6;

    &:hover > td {
      background-color: #ffeac2 !important;
    }
  }

  .ant-table-tbody > tr.row-pending {
    background-color: #f0f9ff;

    &:hover > td {
      background-color: #e0f2fe !important;
    }
  }
`

const statusColor: Record<JobStatus, string> = {
  [JOB_STATUS.REQUEST]: 'purple',
  [JOB_STATUS.PENDING]: 'blue',
  [JOB_STATUS.PROCESSING]: 'orange',
  [JOB_STATUS.COMPLETED]: 'green',
  [JOB_STATUS.FAILED]: 'red',
}

const statusLabels: Record<JobStatus, string> = JOB_STATUS_LABEL

const statusOptions = [
  { value: '', label: '전체' },
  { value: JOB_STATUS.REQUEST, label: '등록요청' },
  { value: JOB_STATUS.PENDING, label: '등록대기' },
  { value: JOB_STATUS.PROCESSING, label: '처리중' },
  { value: JOB_STATUS.COMPLETED, label: '완료' },
  { value: JOB_STATUS.FAILED, label: '실패' },
]

const jobTypeLabels: Record<JobType, string> = {
  [JOB_TYPE.POST]: '포스팅',
  [JOB_TYPE.GENERATE_TOPIC]: '주제 생성',
}

const jobTypeOptions = [
  { value: '', label: '전체' },
  { value: JOB_TYPE.POST, label: '포스팅' },
  { value: JOB_TYPE.GENERATE_TOPIC, label: '주제 생성' },
]

// 상태별 기본 메시지
function getDefaultMessage(status: JobStatus): string {
  switch (status) {
    case JOB_STATUS.PENDING:
      return '처리 대기 중입니다.'
    case JOB_STATUS.PROCESSING:
      return '현재 처리 중입니다.'
    case JOB_STATUS.COMPLETED:
      return '성공적으로 완료되었습니다.'
    case JOB_STATUS.FAILED:
      return '처리 중 오류가 발생했습니다.'
  }
}

// 상태별 타입 반환
function getStatusType(status: JobStatus): string {
  switch (status) {
    case JOB_STATUS.COMPLETED:
      return 'success'
    case JOB_STATUS.FAILED:
      return 'error'
    case JOB_STATUS.PENDING:
      return 'pending'
    case JOB_STATUS.PROCESSING:
      return 'processing'
  }
}

// 상태별 아이콘
function getStatusIcon(status: JobStatus): string {
  switch (status) {
    case JOB_STATUS.PENDING:
      return '⏳'
    case JOB_STATUS.PROCESSING:
      return '⚙️'
    case JOB_STATUS.COMPLETED:
      return '🎉'
    case JOB_STATUS.FAILED:
      return '⚠️'
  }
}

// 상태별 제목
function getStatusTitle(status: JobStatus): string {
  switch (status) {
    case JOB_STATUS.PENDING:
      return '대기 중 상세 정보'
    case JOB_STATUS.PROCESSING:
      return '처리 중 상세 정보'
    case JOB_STATUS.COMPLETED:
      return '완료 상세 정보'
    case JOB_STATUS.FAILED:
      return '실패 원인 상세'
  }
}

const JobTable: React.FC = () => {
  const [data, setData] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<JobType | ''>('')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // JobLog 모달 관련 state
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string>('')
  const [jobLogs, setJobLogs] = useState<JobLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [latestLogs, setLatestLogs] = useState<Record<string, JobLog>>({})

  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null)

  // 벌크 작업 관련 상태
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [bulkRetryLoading, setBulkRetryLoading] = useState(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)

  const [intervalStart, setIntervalStart] = useState<number>(60)
  const [intervalEnd, setIntervalEnd] = useState<number>(90)
  const [intervalApplyLoading, setIntervalApplyLoading] = useState(false)

  const [editingStatusJobId, setEditingStatusJobId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [statusFilter, typeFilter, searchText, sortField, sortOrder])

  useEffect(() => {
    const timer = setInterval(() => {
      // 자동 새로고침 시에는 현재 검색 조건 유지
      fetchData()
    }, 5000)
    return () => clearInterval(timer)
  }, [statusFilter, typeFilter, searchText, sortField, sortOrder])

  // 데이터가 변경될 때 선택 상태 업데이트
  useEffect(() => {
    const validSelectedIds = selectedJobIds.filter(id => data.some(job => job.id === id))
    if (validSelectedIds.length !== selectedJobIds.length) {
      setSelectedJobIds(validSelectedIds)
    }
    setIsAllSelected(validSelectedIds.length > 0 && validSelectedIds.length === data.length)
  }, [data])

  const fetchData = async () => {
    setLoading(true)
    try {
      const json = await getJobs({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        search: searchText || undefined,
        orderBy: sortField,
        order: sortOrder,
      })
      setData(json)

      // 최신 로그들을 가져와서 요약 표시용으로 저장
      const latestLogsData: Record<string, JobLog> = {}
      for (const job of json) {
        try {
          const latestLog = await getLatestJobLog(job.id)
          if (latestLog) {
            latestLogsData[job.id] = latestLog
          }
        } catch (error) {
          // 로그가 없는 경우는 무시
        }
      }
      setLatestLogs(latestLogsData)
    } catch {}
    setLoading(false)
  }

  const showJobLogs = async (jobId: string) => {
    setCurrentJobId(jobId)
    setLogModalVisible(true)
    setLogsLoading(true)

    try {
      const logs = await getJobLogs(jobId)
      setJobLogs(logs)
    } catch (error) {
      message.error('로그를 불러오는데 실패했습니다')
      setJobLogs([])
    }
    setLogsLoading(false)
  }

  const handleRetry = async (id: string) => {
    try {
      const json = await retryJob(id)
      if (json.success) {
        message.success('재시도 요청 완료')
        fetchData()
      } else {
        message.error(json.message || '재시도 실패')
      }
    } catch {
      message.error('재시도 실패')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const json = await deleteJob(id)
      if (json.success) {
        message.success('작업이 삭제되었습니다')
        fetchData()
      } else {
        message.error(json.message || '삭제 실패')
      }
    } catch {
      message.error('삭제 실패')
    }
  }

  const handleDownload = async (jobId: string, type: JobType, xlsxFileName?: string, subject?: string) => {
    setDownloadingJobId(jobId)
    try {
      let blob
      if (type === JOB_TYPE.GENERATE_TOPIC && xlsxFileName) {
        // topicJob xlsx 파일명 활용
        blob = await downloadFindTopicsResult(jobId)
      } else {
        blob = await downloadJobFile(jobId)
      }
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      // 토픽 생성 작업일 때 주제를 파일명에 포함
      let downloadFileName: string
      if (type === JOB_TYPE.GENERATE_TOPIC) {
        const cleanSubject = subject ? subject.replace(/[<>:"/\\|?*]/g, '_').trim() : '토픽'
        downloadFileName = `${cleanSubject}.xlsx`
      } else {
        downloadFileName = xlsxFileName || `job-result-${jobId}.xlsx`
      }

      a.download = downloadFileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      message.success('파일이 다운로드되었습니다.')
    } catch (error: any) {
      message.error(`다운로드 실패: ${error.message}`)
    }
    setDownloadingJobId(null)
  }

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field && sorter.order) {
      setSortField(sorter.field)
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
    }
  }

  // 전체 선택 핸들러
  const handleSelectAll = (checked: boolean) => {
    setIsAllSelected(checked)
    if (checked) {
      setSelectedJobIds(data.map(job => job.id))
    } else {
      setSelectedJobIds([])
    }
  }

  // 개별 선택 핸들러
  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      const newSelectedIds = [...selectedJobIds, jobId]
      setSelectedJobIds(newSelectedIds)
      setIsAllSelected(newSelectedIds.length === data.length)
    } else {
      const newSelectedIds = selectedJobIds.filter(id => id !== jobId)
      setSelectedJobIds(newSelectedIds)
      setIsAllSelected(false)
    }
  }

  // 벌크 재시도 핸들러
  const handleBulkRetry = async () => {
    if (selectedJobIds.length === 0) {
      message.warning('재시도할 작업을 선택해주세요.')
      return
    }

    // 선택된 작업 중 실패한 작업만 필터링
    const failedJobIds = selectedJobIds.filter(jobId => {
      const job = data.find(j => j.id === jobId)
      return job && job.status === JOB_STATUS.FAILED
    })

    if (failedJobIds.length === 0) {
      message.warning('재시도할 수 있는 실패한 작업이 없습니다.')
      return
    }

    setBulkRetryLoading(true)
    try {
      const response = await retryJobs(failedJobIds)
      message.success(response.message)
      setSelectedJobIds([])
      setIsAllSelected(false)
      fetchData()
    } catch (error: any) {
      message.error(error.message || '벌크 재시도에 실패했습니다.')
    }
    setBulkRetryLoading(false)
  }

  // 벌크 삭제 핸들러
  const handleBulkDelete = async () => {
    if (selectedJobIds.length === 0) {
      message.warning('삭제할 작업을 선택해주세요.')
      return
    }

    // 선택된 작업 중 처리 중인 작업 제외
    const deletableJobIds = selectedJobIds.filter(jobId => {
      const job = data.find(j => j.id === jobId)
      return job && job.status !== JOB_STATUS.PROCESSING
    })

    if (deletableJobIds.length === 0) {
      message.warning('삭제할 수 있는 작업이 없습니다. (처리 중인 작업은 삭제할 수 없습니다)')
      return
    }

    setBulkDeleteLoading(true)
    try {
      const response = await deleteJobs(deletableJobIds)
      message.success(response.message)
      setSelectedJobIds([])
      setIsAllSelected(false)
      fetchData()
    } catch (error: any) {
      message.error(error.message || '벌크 삭제에 실패했습니다.')
    }
    setBulkDeleteLoading(false)
  }

  const handleScheduledAtChange = async (jobId: string, date: dayjs.Dayjs | null) => {
    try {
      // 예약시간을 null로 설정하면 즉시발행
      const scheduledAt = date ? date.toISOString() : null
      await api.patch(`/api/jobs/${jobId}`, { scheduledAt })
      message.success('예약시간이 변경되었습니다')
      fetchData()
    } catch {
      message.error('예약시간 변경 실패')
    }
  }

  const handleApplyInterval = async () => {
    // 등록대기(PENDING) 상태인 작업만 필터링
    const pendingJobs = data.filter(job => selectedJobIds.includes(job.id) && job.status === JOB_STATUS.PENDING)
    if (pendingJobs.length < 2) {
      message.warning('등록대기 상태의 작업을 2개 이상 선택해야 합니다.')
      return
    }
    if (intervalStart > intervalEnd) {
      message.warning('시작 분이 끝 분보다 클 수 없습니다.')
      return
    }
    setIntervalApplyLoading(true)
    try {
      // id 기준 오름차순 정렬(순서 고정)
      const selectedJobs = pendingJobs.sort((a, b) => a.id.localeCompare(b.id))
      // 기준 시간: 항상 현재 시간
      let base = new Date()
      for (let i = 0; i < selectedJobs.length; i++) {
        const job = selectedJobs[i]
        if (i === 0) {
          // 첫 Job은 기준 시간 그대로
          await api.patch(`/api/jobs/${job.id}`, { scheduledAt: base.toISOString() })
        } else {
          // 랜덤 간격(분) 추가
          const interval = Math.floor(Math.random() * (intervalEnd - intervalStart + 1)) + intervalStart
          base = new Date(base.getTime() + interval * 60000)
          await api.patch(`/api/jobs/${job.id}`, { scheduledAt: base.toISOString() })
        }
      }
      message.success('간격이 적용되었습니다.')
      fetchData()
    } catch {
      message.error('간격 적용 실패')
    }
    setIntervalApplyLoading(false)
  }

  const handleBulkPendingToRequest = async () => {
    const pendingIds = data
      .filter(job => selectedJobIds.includes(job.id) && job.status === JOB_STATUS.PENDING)
      .map(job => job.id)
    if (pendingIds.length === 0) {
      message.info('등록대기 상태인 작업만 일괄 전환됩니다.')
      return
    }
    try {
      await Promise.all(pendingIds.map(id => pendingToRequest(id)))
      message.success('등록대기 상태가 등록요청으로 일괄 전환되었습니다.')
      fetchData()
    } catch {
      message.error('상태 일괄변경 실패')
    }
  }

  const handleRequestToPending = async (id: string) => {
    try {
      const json = await requestToPending(id)
      if (json.success) {
        message.success('등록대기로 전환되었습니다')
        fetchData()
      } else {
        message.error(json.message || '상태 변경 실패')
      }
    } catch {
      message.error('상태 변경 실패')
    }
  }

  const handleStatusChange = async (job: Job, value: JobStatus) => {
    if (value === job.status) return
    if (job.status === JOB_STATUS.PENDING && value === JOB_STATUS.REQUEST) {
      await pendingToRequest(job.id)
    } else if (job.status === JOB_STATUS.REQUEST && value === JOB_STATUS.PENDING) {
      await requestToPending(job.id)
    }
    setEditingStatusJobId(null)
    fetchData()
  }

  const pendingSelectedCount = data.filter(
    job => selectedJobIds.includes(job.id) && job.status === JOB_STATUS.PENDING,
  ).length

  return (
    <PageContainer title="작업 관리" maxWidth="none">
      {/* 필터 영역 (상태/타입/검색 등) */}
      <div style={{ marginBottom: 12 }}>
        <Space size="middle" wrap>
          <Space>
            <span>상태 필터:</span>
            <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} style={{ width: 120 }} />
          </Space>
          <Space>
            <span>타입 필터:</span>
            <Select value={typeFilter} onChange={setTypeFilter} options={jobTypeOptions} style={{ width: 120 }} />
          </Space>
          <Space>
            <span>검색:</span>
            <Input.Search
              placeholder="제목, 내용, 결과 검색"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onSearch={fetchData}
              style={{ width: 300 }}
              allowClear
            />
          </Space>
        </Space>
      </div>
      {/* 선택 툴바: 선택된 작업이 있을 때만, 필터 아래에 배경색/라운드/패딩 적용 */}
      {selectedJobIds.length > 0 && (
        <div
          style={{
            background: '#f9f9f9',
            borderRadius: 8,
            padding: '14px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 500 }}>{selectedJobIds.length}개 작업이 선택되었습니다.</span>
          <Button type="primary" onClick={handleBulkRetry}>
            실패한 작업 재시도 (
            {data.filter(job => selectedJobIds.includes(job.id) && job.status === JOB_STATUS.FAILED).length}개)
          </Button>
          <Button danger onClick={handleBulkDelete}>
            선택된 작업 삭제 ({selectedJobIds.length}개)
          </Button>
          <Divider />
          <span>등록 간격(분):</span>
          <InputNumber min={1} max={1440} value={intervalStart} onChange={v => setIntervalStart(Number(v))} />
          <span>~</span>
          <InputNumber min={1} max={1440} value={intervalEnd} onChange={v => setIntervalEnd(Number(v))} />
          <Button
            type="primary"
            loading={intervalApplyLoading}
            onClick={handleApplyInterval}
            disabled={pendingSelectedCount === 0}
          >
            간격 적용 ({pendingSelectedCount}개)
          </Button>
          <Button onClick={handleBulkPendingToRequest} disabled={pendingSelectedCount === 0}>
            등록요청 일괄변경 ({pendingSelectedCount}개)
          </Button>
        </div>
      )}
      <StyledTable
        rowKey="id"
        dataSource={data}
        loading={loading}
        pagination={{
          pageSize: 15,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} / 총 ${total}개`,
        }}
        onChange={handleTableChange}
        size="middle"
        bordered
        style={{ background: '#fff' }}
        scroll={{ x: 'max-content' }}
        rowClassName={(record: Job) => `row-${record.status}`}
        columns={[
          {
            title: (
              <Checkbox
                checked={isAllSelected}
                indeterminate={selectedJobIds.length > 0 && selectedJobIds.length < data.length}
                onChange={e => handleSelectAll(e.target.checked)}
              />
            ),
            dataIndex: 'checkbox',
            width: 50,
            align: 'center',
            render: (_: any, record: Job) => (
              <Checkbox
                checked={selectedJobIds.includes(record.id)}
                onChange={e => handleSelectJob(record.id, e.target.checked)}
              />
            ),
          },
          {
            title: '타입',
            dataIndex: 'type',
            width: 100,
            align: 'center',
            render: (type: JobType) => (
              <Tag
                color={type === JOB_TYPE.POST ? 'blue' : 'purple'}
                style={{ cursor: 'pointer' }}
                onClick={() => setTypeFilter(type)}
              >
                {jobTypeLabels[type]}
              </Tag>
            ),
          },
          {
            title: '블로그',
            dataIndex: 'blogName',
            width: 150,
            align: 'center',
            render: (_: any, row: Job) => {
              if (row.type === JOB_TYPE.POST && row.blogJob?.blogName) {
                return (
                  <Tag color="blue" style={{ cursor: 'pointer' }}>
                    {row.blogJob.blogName}
                  </Tag>
                )
              }
              return '-'
            },
          },
          {
            title: '제목',
            dataIndex: 'subject',
            width: 300,
            sorter: true,
            ellipsis: { showTitle: false },
            render: (text: string, row: Job) => (
              <span title={text} style={{ cursor: row.resultUrl ? 'pointer' : 'default' }}>
                {row.status === JOB_STATUS.COMPLETED && row.resultUrl ? (
                  <a
                    onClick={e => {
                      e.preventDefault()
                      window.electronAPI.openExternal(row.resultUrl)
                    }}
                    style={{
                      color: '#1890ff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {text || '-'}
                    <LinkOutlined style={{ fontSize: '12px', opacity: 0.7 }} />
                  </a>
                ) : (
                  text || '-'
                )}
              </span>
            ),
          },
          {
            title: '진행상황',
            dataIndex: 'resultMsg',
            width: 350,
            render: (v: string, row: Job) => {
              const latestLog = latestLogs[row.id]
              const displayMessage = latestLog ? latestLog.message : v || getDefaultMessage(row.status)
              const statusType = getStatusType(row.status)

              const popoverContent = (
                <PopoverContent>
                  <div className={`popover-header ${statusType}`}>
                    {getStatusIcon(row.status)} {getStatusTitle(row.status)}
                  </div>
                  <div className={`popover-message ${statusType}`}>{displayMessage}</div>
                  {latestLog && (
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                      최신 로그: {new Date(latestLog.createdAt).toLocaleString('ko-KR')}
                    </div>
                  )}
                  {row.status === JOB_STATUS.COMPLETED && row.resultUrl && (
                    <div className="result-url">
                      <a
                        href="#"
                        onClick={e => {
                          e.preventDefault()
                          window.electronAPI.openExternal(row.resultUrl)
                        }}
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        등록된 포스팅 보기
                        <LinkOutlined style={{ fontSize: '12px', opacity: 0.7 }} />
                      </a>
                    </div>
                  )}
                </PopoverContent>
              )

              return (
                <Popover
                  content={popoverContent}
                  title={null}
                  trigger="hover"
                  placement="topLeft"
                  mouseEnterDelay={0.3}
                >
                  <ResultCell>
                    <div className={`result-text hover-hint ${statusType}-text`}>{displayMessage}</div>
                    {row.status === JOB_STATUS.COMPLETED && row.resultUrl && (
                      <a
                        href="#"
                        onClick={e => {
                          e.preventDefault()
                          window.electronAPI.openExternal(row.resultUrl)
                        }}
                        style={{
                          color: '#1890ff',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        등록된 포스팅 보기
                        <LinkOutlined style={{ fontSize: '12px', opacity: 0.7 }} />
                      </a>
                    )}
                  </ResultCell>
                </Popover>
              )
            },
            sorter: true,
          },
          {
            title: '상태',
            dataIndex: 'status',
            key: 'status',
            render: (value: JobStatus, record: Job) =>
              editingStatusJobId === record.id ? (
                <Select
                  size="small"
                  value={value}
                  style={{ minWidth: 100 }}
                  onChange={val => handleStatusChange(record, val)}
                  onBlur={() => setEditingStatusJobId(null)}
                  options={[
                    ...(record.status === JOB_STATUS.PENDING
                      ? [
                          { value: JOB_STATUS.PENDING, label: statusLabels[JOB_STATUS.PENDING] },
                          { value: JOB_STATUS.REQUEST, label: statusLabels[JOB_STATUS.REQUEST] },
                        ]
                      : []),
                    ...(record.status === JOB_STATUS.REQUEST
                      ? [
                          { value: JOB_STATUS.REQUEST, label: statusLabels[JOB_STATUS.REQUEST] },
                          { value: JOB_STATUS.PENDING, label: statusLabels[JOB_STATUS.PENDING] },
                        ]
                      : []),
                  ]}
                  autoFocus
                />
              ) : (
                <Tag
                  color={statusColor[value]}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setEditingStatusJobId(record.id)}
                >
                  {statusLabels[value]}
                </Tag>
              ),
          },
          {
            title: '예약시간',
            dataIndex: 'scheduledAt',
            key: 'scheduledAt',
            render: (value: string, record: Job) => (
              <DatePicker
                locale={locale}
                showTime
                value={value ? dayjs(value) : null}
                onChange={date => handleScheduledAtChange(record.id, date)}
                allowClear
                format="YYYY-MM-DD ddd HH:mm"
                style={{ minWidth: 150 }}
                getPopupContainer={() => document.body}
              />
            ),
            sorter: true,
          },
          {
            title: '액션',
            dataIndex: 'action',
            width: 150,
            fixed: 'right',
            align: 'center',
            render: (_: any, row: Job) => (
              <Space size="small" direction="vertical">
                <Space size="small">
                  <Button size="small" onClick={() => showJobLogs(row.id)} style={{ fontSize: '11px' }}>
                    상세
                  </Button>
                  {row.status === JOB_STATUS.FAILED && (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => handleRetry(row.id)}
                      style={{ fontSize: '11px' }}
                    >
                      재시도
                    </Button>
                  )}
                  {row.type === JOB_TYPE.GENERATE_TOPIC && row.status === JOB_STATUS.COMPLETED && (
                    <Button
                      type="primary"
                      size="small"
                      loading={downloadingJobId === row.id}
                      disabled={
                        (downloadingJobId !== null && downloadingJobId !== row.id) || !row.topicJob?.xlsxFileName
                      }
                      onClick={() => handleDownload(row.id, row.type, row.topicJob?.xlsxFileName, row.subject)}
                      style={{ fontSize: '11px', backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                    >
                      다운로드
                    </Button>
                  )}
                  {/* BLOG_POST(포스팅) 타입은 다운로드 버튼을 렌더링하지 않음 */}
                </Space>
                {row.status !== JOB_STATUS.PROCESSING && (
                  <Popconfirm
                    title="정말 삭제하시겠습니까?"
                    onConfirm={() => handleDelete(row.id)}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button danger size="small" style={{ fontSize: '11px', width: '100%' }}>
                      삭제
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      {/* JobLog 모달 */}
      <Modal
        title={`작업 로그 (ID: ${currentJobId})`}
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setLogModalVisible(false)}>
            닫기
          </Button>,
        ]}
        width={800}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {logsLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>로그를 불러오는 중...</div>
          ) : jobLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>로그가 없습니다.</div>
          ) : (
            <div>
              {jobLogs.map((log, index) => (
                <div
                  key={log.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: index === jobLogs.length - 1 ? 'none' : '1px solid #f0f0f0',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>
                    {new Date(log.createdAt).toLocaleString('ko-KR')}
                  </div>
                  <div style={{ color: '#333' }}>{log.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  )
}

export default JobTable
