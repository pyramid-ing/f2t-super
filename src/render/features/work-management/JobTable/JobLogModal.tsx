import React, { useEffect, useState } from 'react'
import { Button, Modal, message } from 'antd'
import { getJobLogs } from '@render/api'

interface JobLogModalProps {
  visible: boolean
  onClose: () => void
  jobId: string
}

const JobLogModal: React.FC<JobLogModalProps> = ({ visible, onClose, jobId }) => {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchLogs = async () => {
    if (!jobId) return

    setLoading(true)
    try {
      const logsData = await getJobLogs(jobId)
      setLogs(Array.isArray(logsData) ? logsData : [])
    } catch (error) {
      message.error('로그를 불러오는데 실패했습니다')
      setLogs([])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (visible && jobId) {
      fetchLogs()
    }
  }, [visible, jobId])

  return (
    <Modal
      title={`작업 로그 (ID: ${jobId})`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>,
      ]}
      width={800}
    >
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>로그를 불러오는 중...</div>
        ) : !Array.isArray(logs) || logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>로그가 없습니다.</div>
        ) : (
          <div>
            {logs.map((log, index) => (
              <div
                key={log.id || index}
                style={{
                  padding: '8px 12px',
                  borderBottom: index === logs.length - 1 ? 'none' : '1px solid #f0f0f0',
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
  )
}

export default JobLogModal
