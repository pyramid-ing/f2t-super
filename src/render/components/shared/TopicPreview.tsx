import React, { useState } from 'react'
import { Card, Table, Button, Space, Typography, Modal, Input, Rate, Tag, message, Select, Checkbox } from 'antd'
import {
  EditOutlined,
  EyeOutlined,
  DownloadOutlined,
  StarOutlined,
  SendOutlined,
  MoonOutlined,
} from '@ant-design/icons'
import { TopicResult } from '../../types/topic'
import { convertTopicToBlogPost, improveTopicQuality, classifyTopic } from '@render/api'

const { Text, Title } = Typography
const { TextArea } = Input

interface TopicPreviewProps {
  topics: TopicResult[]
  jobId: string
  onDownload?: () => void
  onEdit?: (index: number, topic: TopicResult) => void
  onRate?: (index: number, rating: number) => void
  onConvert?: (selectedTopics: number[], platform: string) => void
}

interface TopicWithRating extends TopicResult {
  rating?: number
  isEditing?: boolean
}

const TopicPreview: React.FC<TopicPreviewProps> = ({ topics, jobId, onDownload, onEdit, onRate, onConvert }) => {
  const [topicsWithRating, setTopicsWithRating] = useState<TopicWithRating[]>(
    topics.map(topic => ({ ...topic, rating: 0, isEditing: false })),
  )
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingTopic, setEditingTopic] = useState<TopicResult | null>(null)
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number>(0)
  const [selectedTopics, setSelectedTopics] = useState<number[]>([])
  const [conversionModalVisible, setConversionModalVisible] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('blogger')
  const [converting, setConverting] = useState(false)

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setEditingTopic(topicsWithRating[index])
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null && editingTopic) {
      const updatedTopics = [...topicsWithRating]
      updatedTopics[editingIndex] = { ...editingTopic, isEditing: false }
      setTopicsWithRating(updatedTopics)
      onEdit?.(editingIndex, editingTopic)
      setEditingIndex(null)
      setEditingTopic(null)
      message.success('토픽이 수정되었습니다.')
    }
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingTopic(null)
  }

  const handleRate = (index: number, rating: number) => {
    const updatedTopics = [...topicsWithRating]
    updatedTopics[index].rating = rating
    setTopicsWithRating(updatedTopics)
    onRate?.(index, rating)
  }

  const handlePreview = (index: number) => {
    setPreviewIndex(index)
    setPreviewModalVisible(true)
  }

  const handleTopicSelection = (index: number, checked: boolean) => {
    if (checked) {
      setSelectedTopics([...selectedTopics, index])
    } else {
      setSelectedTopics(selectedTopics.filter(i => i !== index))
    }
  }

  const handleConvertToBlogPost = async () => {
    if (selectedTopics.length === 0) {
      message.warning('변환할 토픽을 선택해주세요.')
      return
    }

    setConverting(true)
    try {
      const result = await convertTopicToBlogPost(jobId, selectedTopics, selectedPlatform as any)
      message.success(result.message)
      setConversionModalVisible(false)
      setSelectedTopics([])
      onConvert?.(selectedTopics, selectedPlatform)
    } catch (error: any) {
      message.error(error.message || '토픽 변환에 실패했습니다.')
    } finally {
      setConverting(false)
    }
  }

  const handleImproveQuality = async (index: number) => {
    try {
      const improvedTopic = await improveTopicQuality(topicsWithRating[index])
      const updatedTopics = [...topicsWithRating]
      updatedTopics[index] = { ...improvedTopic, rating: updatedTopics[index].rating }
      setTopicsWithRating(updatedTopics)
      message.success('토픽 품질이 개선되었습니다.')
    } catch (error: any) {
      message.error('토픽 품질 개선에 실패했습니다.')
    }
  }

  const handleClassifyTopic = async (index: number) => {
    try {
      const category = await classifyTopic(topicsWithRating[index])
      message.info(`토픽 카테고리: ${category}`)
    } catch (error: any) {
      message.error('토픽 분류에 실패했습니다.')
    }
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'success'
    if (rating >= 2) return 'warning'
    return 'error'
  }

  const getRatingText = (rating: number) => {
    if (rating >= 4) return '우수'
    if (rating >= 2) return '보통'
    return '개선 필요'
  }

  const columns = [
    {
      title: '선택',
      key: 'selection',
      width: 60,
      render: (text: any, record: any, index: number) => (
        <Checkbox
          checked={selectedTopics.includes(index)}
          onChange={e => handleTopicSelection(index, e.target.checked)}
        />
      ),
    },
    {
      title: '순서',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (text: any, record: any, index: number) => index + 1,
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: TopicWithRating, index: number) => {
        if (editingIndex === index) {
          return (
            <Input
              value={editingTopic?.title || ''}
              onChange={e => setEditingTopic(prev => (prev ? { ...prev, title: e.target.value } : null))}
              placeholder="제목을 입력하세요"
            />
          )
        }
        return (
          <Text strong style={{ cursor: 'pointer' }} onClick={() => handlePreview(index)}>
            {text}
          </Text>
        )
      },
    },
    {
      title: '내용',
      dataIndex: 'content',
      key: 'content',
      render: (text: string, record: TopicWithRating, index: number) => {
        if (editingIndex === index) {
          return (
            <TextArea
              value={editingTopic?.content || ''}
              onChange={e => setEditingTopic(prev => (prev ? { ...prev, content: e.target.value } : null))}
              placeholder="내용을 입력하세요"
              rows={3}
            />
          )
        }
        return <Text ellipsis={{ tooltip: text }}>{text.length > 100 ? `${text.substring(0, 100)}...` : text}</Text>
      },
    },
    {
      title: '평가',
      dataIndex: 'rating',
      key: 'rating',
      width: 120,
      render: (rating: number, record: TopicWithRating, index: number) => (
        <Rate
          value={rating}
          onChange={value => handleRate(index, value)}
          tooltips={['매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음']}
        />
      ),
    },
    {
      title: '상태',
      dataIndex: 'rating',
      key: 'status',
      width: 100,
      render: (rating: number) => <Tag color={getRatingColor(rating)}>{getRatingText(rating)}</Tag>,
    },
    {
      title: '작업',
      key: 'actions',
      width: 200,
      render: (text: any, record: TopicWithRating, index: number) => (
        <Space>
          {editingIndex === index ? (
            <>
              <Button size="small" type="primary" onClick={handleSaveEdit}>
                저장
              </Button>
              <Button size="small" onClick={handleCancelEdit}>
                취소
              </Button>
            </>
          ) : (
            <>
              <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(index)} />
              <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(index)} />
              <Button
                size="small"
                icon={<MoonOutlined />}
                onClick={() => handleImproveQuality(index)}
                title="품질 개선"
              />
              <Button
                size="small"
                icon={<StarOutlined />}
                onClick={() => handleClassifyTopic(index)}
                title="카테고리 분류"
              />
            </>
          )}
        </Space>
      ),
    },
  ]

  const averageRating = topicsWithRating.reduce((sum, topic) => sum + (topic.rating || 0), 0) / topicsWithRating.length

  return (
    <div>
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              📋 토픽 생성 결과 미리보기
            </Title>
            <Tag color="blue">총 {topicsWithRating.length}개</Tag>
            <Tag color="green">평균 평가: {averageRating.toFixed(1)}/5</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SendOutlined />} onClick={() => setConversionModalVisible(true)}>
              블로그 포스트로 변환
            </Button>
            <Button icon={<DownloadOutlined />} onClick={onDownload}>
              Excel 다운로드
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={topicsWithRating}
          rowKey={(record, index) => index?.toString() || '0'}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}개`,
          }}
          size="small"
        />
      </Card>

      {/* 토픽 상세 미리보기 모달 */}
      <Modal
        title={`토픽 상세보기 (${previewIndex + 1}/${topicsWithRating.length})`}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={[
          <Button key="prev" disabled={previewIndex === 0} onClick={() => setPreviewIndex(previewIndex - 1)}>
            이전
          </Button>,
          <Button
            key="next"
            disabled={previewIndex === topicsWithRating.length - 1}
            onClick={() => setPreviewIndex(previewIndex + 1)}
          >
            다음
          </Button>,
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            닫기
          </Button>,
        ]}
        width={800}
      >
        {topicsWithRating[previewIndex] && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>제목:</Text>
              <div style={{ marginTop: 8, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                {topicsWithRating[previewIndex].title}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>내용:</Text>
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 4,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {topicsWithRating[previewIndex].content}
              </div>
            </div>
            <div>
              <Text strong>평가:</Text>
              <div style={{ marginTop: 8 }}>
                <Rate
                  value={topicsWithRating[previewIndex].rating}
                  onChange={value => handleRate(previewIndex, value)}
                  tooltips={['매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음']}
                />
                <Tag color={getRatingColor(topicsWithRating[previewIndex].rating || 0)} style={{ marginLeft: 8 }}>
                  {getRatingText(topicsWithRating[previewIndex].rating || 0)}
                </Tag>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 토픽 변환 모달 */}
      <Modal
        title="토픽을 블로그 포스트로 변환"
        open={conversionModalVisible}
        onCancel={() => setConversionModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setConversionModalVisible(false)}>
            취소
          </Button>,
          <Button
            key="convert"
            type="primary"
            loading={converting}
            onClick={handleConvertToBlogPost}
            disabled={selectedTopics.length === 0}
          >
            변환하기
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>선택된 토픽: {selectedTopics.length}개</Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong>플랫폼 선택:</Text>
          <Select value={selectedPlatform} onChange={setSelectedPlatform} style={{ width: '100%', marginTop: 8 }}>
            <Select.Option value="blogger">Google Blogger</Select.Option>
            <Select.Option value="wordpress">WordPress</Select.Option>
            <Select.Option value="tistory">Tistory</Select.Option>
          </Select>
        </div>
        <div>
          <Text type="secondary">선택한 토픽들이 블로그 포스트 작업으로 변환됩니다.</Text>
        </div>
      </Modal>
    </div>
  )
}

export default TopicPreview
