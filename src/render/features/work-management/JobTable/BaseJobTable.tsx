import React, { useState } from 'react'
import { Button, message, Modal, Table, InputNumber, Divider } from 'antd'
import styled from 'styled-components'
import { Job, JobStatus, JobLog, JOB_STATUS, JOB_STATUS_LABEL } from '@render/api'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'

// 스타일 컴포넌트들 (기존 JobTable에서 가져옴)
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

// 상태별 색상 및 라벨
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

const jobTypeLabels: Record<string, string> = {
  'blog-info-posting': '블로그 포스팅',
  generate_topic: '주제 생성',
  'coupang-review-posting': '쿠팡 리뷰 포스팅',
}

const jobTypeOptions = [
  { value: 'blog-info-posting', label: '블로그 포스팅' },
  { value: 'generate_topic', label: '주제 생성' },
  { value: 'coupang-review-posting', label: '쿠팡 리뷰 포스팅' },
]

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

// BaseJobTable Props 인터페이스
export interface BaseJobTableProps {
  data: Job[]
  loading: boolean
  columns: any[]
  onFetchData: () => void
  onRetry: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDownload?: (jobId: string, type: string, xlsxFileName?: string, subject?: string) => Promise<void>
  onShowLogs: (job: Job) => Promise<void>
  onScheduledAtChange: (jobId: string, date: dayjs.Dayjs | null) => Promise<void>
  onStatusChange: (job: Job, value: JobStatus) => Promise<void>
  onBulkRetry: () => Promise<void>
  onBulkDelete: () => Promise<void>
  onApplyInterval: () => Promise<void>
  onBulkPendingToRequest: () => Promise<void>
  selectedJobIds: string[]
  onSelectAll: (checked: boolean) => void
  onSelectJob: (jobId: string, checked: boolean) => void
  isAllSelected: boolean
  bulkRetryLoading: boolean
  bulkDeleteLoading: boolean
  intervalApplyLoading: boolean
  downloadingJobId: string | null
  editingStatusJobId: string | null
  setEditingStatusJobId: (id: string | null) => void
  intervalStart: number
  intervalEnd: number
  setIntervalStart: (value: number) => void
  setIntervalEnd: (value: number) => void
}

const BaseJobTable: React.FC<BaseJobTableProps> = ({
  data,
  loading,
  columns,
  onFetchData,
  onRetry,
  onDelete,
  onDownload,
  onShowLogs,
  onScheduledAtChange,
  onStatusChange,
  onBulkRetry,
  onBulkDelete,
  onApplyInterval,
  onBulkPendingToRequest,
  selectedJobIds,
  onSelectAll,
  onSelectJob,
  isAllSelected,
  bulkRetryLoading,
  bulkDeleteLoading,
  intervalApplyLoading,
  downloadingJobId,
  editingStatusJobId,
  setEditingStatusJobId,
  intervalStart,
  intervalEnd,
  setIntervalStart,
  setIntervalEnd,
}) => {
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string>('')
  const [jobLogs, setJobLogs] = useState<JobLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const showJobLogs = async (job: Job) => {
    setCurrentJobId(job.id)
    setLogModalVisible(true)
    setLogsLoading(true)

    try {
      await onShowLogs(job)
    } catch (error) {
      message.error('로그를 불러오는데 실패했습니다')
    }
    setLogsLoading(false)
  }

  const handleRetry = async (id: string) => {
    try {
      await onRetry(id)
      message.success('재시도 요청 완료')
      onFetchData()
    } catch {
      message.error('재시도 실패')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id)
      message.success('작업이 삭제되었습니다')
      onFetchData()
    } catch {
      message.error('삭제 실패')
    }
  }

  const handleDownload = async (jobId: string, type: string, xlsxFileName?: string, subject?: string) => {
    if (!onDownload) return

    try {
      await onDownload(jobId, type, xlsxFileName, subject)
      message.success('파일이 다운로드되었습니다.')
    } catch (error: any) {
      message.error(`다운로드 실패: ${error.message}`)
    }
  }

  const handleScheduledAtChange = async (jobId: string, date: dayjs.Dayjs | null) => {
    try {
      await onScheduledAtChange(jobId, date)
      message.success('예약시간이 변경되었습니다')
      onFetchData()
    } catch {
      message.error('예약시간 변경 실패')
    }
  }

  const handleStatusChange = async (job: Job, value: JobStatus) => {
    if (value === job.status) return
    await onStatusChange(job, value)
    setEditingStatusJobId(null)
    onFetchData()
  }

  const pendingSelectedCount = data.filter(
    job => selectedJobIds.includes(job.id) && job.status === JOB_STATUS.PENDING,
  ).length

  return (
    <>
      {/* 선택 툴바 */}
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
          <Button type="primary" onClick={onBulkRetry} loading={bulkRetryLoading}>
            실패한 작업 재시도 (
            {data.filter(job => selectedJobIds.includes(job.id) && job.status === JOB_STATUS.FAILED).length}개)
          </Button>
          <Button danger onClick={onBulkDelete} loading={bulkDeleteLoading}>
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
            onClick={onApplyInterval}
            disabled={pendingSelectedCount === 0}
          >
            간격 적용 ({pendingSelectedCount}개)
          </Button>
          <Button onClick={onBulkPendingToRequest} disabled={pendingSelectedCount === 0}>
            등록요청 일괄변경 ({pendingSelectedCount}개)
          </Button>
        </div>
      )}

      {/* 테이블 */}
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
        size="middle"
        bordered
        style={{ background: '#fff' }}
        scroll={{ x: 'max-content' }}
        rowClassName={(record: Job) => `row-${record.status}`}
        columns={columns}
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
    </>
  )
}

export default BaseJobTable
