import React from 'react'
import { Button, Modal, Space, Tag } from 'antd'
import { JOB_STATUS, JobStatus } from '@render/api'

export interface IndexingDetailRow {
  url: string
  statuses: Record<string, JobStatus>
}

interface Props {
  open: boolean
  loading: boolean
  title?: string
  rows: IndexingDetailRow[]
  onClose: () => void
}

const statusColor: Record<JobStatus, string> = {
  [JOB_STATUS.PENDING]: 'blue',
  [JOB_STATUS.PROCESSING]: 'orange',
  [JOB_STATUS.COMPLETED]: 'green',
  [JOB_STATUS.FAILED]: 'red',
  [JOB_STATUS.REQUEST]: 'purple',
}

const statusLabels: Record<JobStatus, string> = {
  [JOB_STATUS.PENDING]: '등록대기',
  [JOB_STATUS.REQUEST]: '등록요청',
  [JOB_STATUS.PROCESSING]: '처리중',
  [JOB_STATUS.COMPLETED]: '완료',
  [JOB_STATUS.FAILED]: '실패',
}

const IndexingDetailModal: React.FC<Props> = ({ open, loading, title, rows, onClose }) => {
  return (
    <Modal
      title={title || '인덱싱 상세'}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>,
      ]}
      width={800}
    >
      <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>상세 정보를 불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>표시할 URL 정보가 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map(row => {
              let decoded = row.url
              try {
                decoded = decodeURIComponent(row.url)
              } catch {}
              return (
                <div
                  key={row.url}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    background: '#fafafa',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{decoded}</div>
                  <Space wrap size="small">
                    {Object.entries(row.statuses).map(([provider, st]) => (
                      <Tag key={provider} color={statusColor[st]}>
                        {provider}: {statusLabels[st]}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default IndexingDetailModal
