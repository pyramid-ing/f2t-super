import React, { useEffect, useState } from 'react'
import { Button, Checkbox, DatePicker, message, Popconfirm, Popover, Select, Space, Tag } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import locale from 'antd/es/date-picker/locale/ko_KR'
import BaseJobTable, { BaseJobTableProps } from './BaseJobTable'
import JobLogModal from './JobLogModal'
import {
  api,
  deleteJob,
  deleteJobs,
  getJobs,
  Job,
  JOB_STATUS,
  JOB_STATUS_LABEL,
  JobStatus,
  pendingToRequest,
  requestToPending,
  retryJob,
  retryJobs,
} from '@render/api'
import { JobTargetType } from '@main/app/modules/job/job.types'

// 스타일 컴포넌트 (BaseJobTable에서 가져옴)
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

// 상태별 색상 및 라벨
const statusColor: Record<JobStatus, string> = {
  [JOB_STATUS.REQUEST]: 'purple',
  [JOB_STATUS.PENDING]: 'blue',
  [JOB_STATUS.PROCESSING]: 'orange',
  [JOB_STATUS.COMPLETED]: 'green',
  [JOB_STATUS.FAILED]: 'red',
}

const statusLabels: Record<JobStatus, string> = JOB_STATUS_LABEL

const jobTypeLabels: Record<string, string> = {
  [JobTargetType.BLOG_INFO_POSTING]: '블로그 포스팅',
  [JobTargetType.GENERATE_TOPIC]: '주제 생성',
  [JobTargetType.COUPANG_REVIEW_POSTING]: '쿠팡 리뷰 포스팅',
}

// 유틸리티 함수들
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

interface CoupangBlogJobTableProps {
  statusFilter: JobStatus | ''
  searchText: string
  sortField: string
  sortOrder: 'asc' | 'desc'
  onTableChange: (pagination: any, filters: any, sorter: any) => void
}

const CoupangBlogJobTable: React.FC<CoupangBlogJobTableProps> = ({
  statusFilter,
  searchText,
  sortField,
  sortOrder,
  onTableChange,
}) => {
  const [data, setData] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [bulkRetryLoading, setBulkRetryLoading] = useState(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [intervalStart, setIntervalStart] = useState<number>(60)
  const [intervalEnd, setIntervalEnd] = useState<number>(90)
  const [intervalApplyLoading, setIntervalApplyLoading] = useState(false)
  const [editingStatusJobId, setEditingStatusJobId] = useState<string | null>(null)
  const [latestLogs, setLatestLogs] = useState<Record<string, any>>({})
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [currentJob, setCurrentJob] = useState<Job | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const json = await getJobs({
        status: statusFilter || undefined,
        search: searchText || undefined,
        orderBy: sortField,
        order: sortOrder,
        targetType: JobTargetType.COUPANG_REVIEW_POSTING, // 쿠팡 작업만 필터링
      })
      setData(json)

      // 최신 로그들을 가져와서 요약 표시용으로 저장
      const latestLogsData: Record<string, any> = {}
      for (const job of json) {
        try {
          // getLatestJobLog API 호출 (실제 구현 필요)
          // const latestLog = await getLatestJobLog(job.id)
          // if (latestLog) {
          //   latestLogsData[job.id] = latestLog
          // }
        } catch (error) {
          // 로그가 없는 경우는 무시
        }
      }
      setLatestLogs(latestLogsData)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [statusFilter, searchText, sortField, sortOrder])

  useEffect(() => {
    const timer = setInterval(() => {
      fetchData()
    }, 5000)
    return () => clearInterval(timer)
  }, [statusFilter, searchText, sortField, sortOrder])

  useEffect(() => {
    const validSelectedIds = selectedJobIds.filter(id => data.some(job => job.id === id))
    if (validSelectedIds.length !== selectedJobIds.length) {
      setSelectedJobIds(validSelectedIds)
    }
    setIsAllSelected(validSelectedIds.length > 0 && validSelectedIds.length === data.length)
  }, [data])

  const handleSelectAll = (checked: boolean) => {
    setIsAllSelected(checked)
    if (checked) {
      setSelectedJobIds(data.map(job => job.id))
    } else {
      setSelectedJobIds([])
    }
  }

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

  const handleShowLogs = async (job: Job) => {
    setCurrentJob(job)
    setLogModalVisible(true)
  }

  const handleCloseLogModal = () => {
    setLogModalVisible(false)
    setCurrentJob(null)
  }

  const handleScheduledAtChange = async (jobId: string, date: dayjs.Dayjs | null) => {
    try {
      const scheduledAt = date ? date.toISOString() : null
      await api.patch(`/api/jobs/${jobId}`, { scheduledAt })
      message.success('예약시간이 변경되었습니다')
      fetchData()
    } catch {
      message.error('예약시간 변경 실패')
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

  const handleBulkRetry = async () => {
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

  const handleBulkDelete = async () => {
    const deletableJobIds = selectedJobIds.filter(jobId => {
      const job = data.find(j => j.id === jobId)
      return job && job.status !== JOB_STATUS.PROCESSING
    })

    if (deletableJobIds.length === 0) {
      message.warning('삭제할 수 있는 작업이 없습니다.')
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

  const handleApplyInterval = async () => {
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
      const selectedJobs = pendingJobs.sort((a, b) => a.id.localeCompare(b.id))
      let base = new Date()
      for (let i = 0; i < selectedJobs.length; i++) {
        const job = selectedJobs[i]
        if (i === 0) {
          await api.patch(`/api/jobs/${job.id}`, { scheduledAt: base.toISOString() })
        } else {
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

  const columns = [
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
      align: 'center' as const,
      render: (_: any, record: Job) => (
        <Checkbox
          checked={selectedJobIds.includes(record.id)}
          onChange={e => handleSelectJob(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '쿠팡 URL',
      dataIndex: 'coupangUrls',
      width: 200,
      align: 'center' as const,
      render: (_: any, row: Job) => {
        const urls = row.coupangBlogJob?.coupangUrls as string[] | undefined
        if (urls?.length) {
          return (
            <a
              onClick={e => {
                e.preventDefault()
                window.electronAPI.openExternal(urls[0])
              }}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1890ff', fontSize: '12px' }}
            >
              상품 보기
            </a>
          )
        }
        return '-'
      },
    },
    {
      title: '카테고리',
      dataIndex: 'category',
      width: 120,
      align: 'center' as const,
      render: (_: any, row: Job) => {
        return row.coupangBlogJob?.category || '-'
      },
    },
    {
      title: '발행 플랫폼',
      dataIndex: 'platform',
      width: 150,
      align: 'center' as const,
      render: (_: any, row: Job) => {
        const coupangJob = row.coupangBlogJob
        if (!coupangJob) return '-'

        if (coupangJob.tistoryAccount) {
          return `티스토리:${coupangJob.tistoryAccount.name || coupangJob.tistoryAccountId}`
        } else if (coupangJob.wordpressAccount) {
          return `워드프레스:${coupangJob.wordpressAccount.name || coupangJob.wordpressAccountId}`
        } else if (coupangJob.bloggerAccount) {
          return `블로거:${coupangJob.bloggerAccount.name || coupangJob.bloggerAccountId}`
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
      title: '결과 URL',
      dataIndex: 'resultUrl',
      width: 200,
      align: 'center' as const,
      render: (_: any, row: Job) => {
        if (row.coupangBlogJob?.resultUrl) {
          return (
            <a
              onClick={e => {
                e.preventDefault()
                window.electronAPI.openExternal(row.coupangBlogJob.resultUrl)
              }}
              style={{ color: '#1890ff', fontSize: '12px' }}
            >
              결과 보기
            </a>
          )
        }
        return '-'
      },
    },
    {
      title: '발행시각',
      dataIndex: 'publishedAt',
      width: 150,
      align: 'center' as const,
      render: (_: any, row: Job) => {
        if (row.coupangBlogJob?.publishedAt) {
          return dayjs(row.coupangBlogJob.publishedAt).format('YYYY-MM-DD HH:mm')
        }
        return '-'
      },
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
          <Popover content={popoverContent} title={null} trigger="hover" placement="topLeft" mouseEnterDelay={0.3}>
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
              ...(record.status === JOB_STATUS.FAILED
                ? [{ value: JOB_STATUS.REQUEST, label: statusLabels[JOB_STATUS.REQUEST] }]
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
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, row: Job) => (
        <Space size="small" direction="vertical">
          <Space size="small">
            <Button size="small" onClick={() => handleShowLogs(row)} style={{ fontSize: '11px' }}>
              상세
            </Button>
            {row.status === JOB_STATUS.FAILED && (
              <Button type="primary" size="small" onClick={() => handleRetry(row.id)} style={{ fontSize: '11px' }}>
                재시도
              </Button>
            )}
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
  ]

  const baseProps: BaseJobTableProps = {
    data,
    loading,
    columns,
    onFetchData: fetchData,
    onRetry: handleRetry,
    onDelete: handleDelete,
    onShowLogs: handleShowLogs,
    onScheduledAtChange: handleScheduledAtChange,
    onStatusChange: handleStatusChange,
    onBulkRetry: handleBulkRetry,
    onBulkDelete: handleBulkDelete,
    onApplyInterval: handleApplyInterval,
    onBulkPendingToRequest: handleBulkPendingToRequest,
    selectedJobIds,
    onSelectAll: handleSelectAll,
    onSelectJob: handleSelectJob,
    isAllSelected,
    bulkRetryLoading,
    bulkDeleteLoading,
    intervalApplyLoading,
    downloadingJobId: null,
    editingStatusJobId,
    setEditingStatusJobId,
    intervalStart,
    intervalEnd,
    setIntervalStart,
    setIntervalEnd,
  }

  return (
    <>
      <BaseJobTable {...baseProps} />

      {/* 로그 모달 */}
      <JobLogModal visible={logModalVisible} onClose={handleCloseLogModal} jobId={currentJob?.id || ''} />
    </>
  )
}

export default CoupangBlogJobTable
