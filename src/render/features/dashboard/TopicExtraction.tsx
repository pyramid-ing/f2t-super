import { Button, Input, message } from 'antd'
import React from 'react'
import { addTopicJob } from '../../api'

const TopicExtraction: React.FC = () => {
  const [topic, setTopic] = React.useState('')
  const [limit, setLimit] = React.useState(10)
  const [loading, setLoading] = React.useState(false)

  const handleFindTopics = async () => {
    setLoading(true)

    try {
      await addTopicJob(topic, limit)
      message.success(`${topic}에 대한 주제찾기 작업이 등록되었습니다.`)
    } catch (e: any) {
      message.error(e?.message || '엑셀 내보내기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          padding: 16,
          backgroundColor: '#f6f8fa',
          borderRadius: 8,
          border: '1px solid #e1e4e8',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>📋 다운로드되는 엑셀 파일 형식</h4>
        <p style={{ margin: 0, fontSize: '14px', color: '#586069' }}>생성된 엑셀 파일에는 다음 컬럼이 포함됩니다:</p>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '14px', color: '#586069' }}>
          <li>
            <strong>제목</strong>: AI가 생성한 블로그 포스트 제목
          </li>
          <li>
            <strong>내용</strong>: AI가 생성한 블로그 포스트 내용
          </li>
          <li>
            <strong>예약날짜</strong>: 발행 예정일 (수동 입력)
          </li>
          <li>
            <strong>라벨</strong>: 블로그 카테고리/태그 (수동 입력, 쉼표로 구분)
          </li>
          <li>
            <strong>블로거 ID</strong>: 특정 블로거 ID (수동 입력, 비워두면 기본 블로거 사용)
          </li>
        </ul>
        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6a737d' }}>
          라벨 예시: "기술,프로그래밍,웹개발" - 이렇게 입력하면 블로그에 해당 카테고리가 자동으로 설정됩니다.
        </p>
      </div>

      <Input
        placeholder="주제 입력"
        value={topic}
        onChange={e => setTopic(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <Input
        placeholder="제한"
        type="number"
        value={limit}
        onChange={e => setLimit(Number(e.target.value))}
        style={{ marginBottom: 8 }}
      />
      <Button type="primary" onClick={handleFindTopics} loading={loading}>
        주제 찾기 작업 등록
      </Button>
    </div>
  )
}

export default TopicExtraction
