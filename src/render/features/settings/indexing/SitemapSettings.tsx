import React, { useState, useEffect } from 'react'
import {
  Form,
  Switch,
  Button,
  Alert,
  Card,
  Space,
  Typography,
  Tag,
  List,
  Modal,
  message,
  Select,
  DatePicker,
  Input,
} from 'antd'
import {
  CalendarOutlined,
  GlobalOutlined,
  LoadingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  sitemapApi,
  SitemapConfig,
  CreateSitemapConfigDto,
  UpdateSitemapConfigDto,
  IndexingConfig,
} from '@render/api/sitemapApi'
import dayjs from 'dayjs'

const { Text, Title } = Typography
const { Option } = Select

const SITEMAP_TYPES = [
  { value: 'blogspot', label: 'Blogspot', description: 'Blogspot 블로그 사이트맵' },
  { value: 'tistory', label: '티스토리', description: '티스토리 블로그 사이트맵' },
  {
    value: 'wordpress',
    label: '워드프레스 (RankMath SEO)',
    description: '워드프레스 RankMath SEO 사이트맵',
  },
]

interface SitemapSettingsProps {
  siteId: number
}

export const SitemapSettings: React.FC<SitemapSettingsProps> = ({ siteId }) => {
  const [configs, setConfigs] = useState<SitemapConfig[]>([])
  const [indexingConfig, setIndexingConfig] = useState<IndexingConfig>({
    mode: 'fromDate',
    startDate: dayjs().format('YYYY-MM-DD'),
  })
  const [modalVisible, setModalVisible] = useState(false)
  const [indexingModalVisible, setIndexingModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState<SitemapConfig | null>(null)
  const [form] = Form.useForm()
  const [indexingForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    loadSitemapConfigs()
    loadIndexingConfig()
  }, [siteId])

  const loadSitemapConfigs = async () => {
    try {
      setLoading(true)
      const data = await sitemapApi.getSitemapConfigs(siteId)
      setConfigs(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadIndexingConfig = async () => {
    try {
      const config = await sitemapApi.getIndexingConfig(siteId)
      setIndexingConfig(config)
    } catch (err) {
      console.error('색인 기준 설정 로드 실패:', err)
    }
  }

  const handleAddConfig = () => {
    setEditingConfig(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditConfig = (config: SitemapConfig) => {
    setEditingConfig(config)
    form.setFieldsValue({
      name: config.name,
      sitemapType: config.sitemapType,
      isEnabled: config.isEnabled,
    })
    setModalVisible(true)
  }

  const handleDeleteConfig = async (id: string) => {
    try {
      setLoading(true)
      await sitemapApi.deleteSitemapConfig(id)
      message.success('사이트맵 설정이 삭제되었습니다.')
      await loadSitemapConfigs()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (values: CreateSitemapConfigDto | UpdateSitemapConfigDto) => {
    try {
      setLoading(true)

      if (editingConfig) {
        await sitemapApi.updateSitemapConfig(editingConfig.id, values as UpdateSitemapConfigDto)
        message.success('사이트맵 설정이 수정되었습니다.')
      } else {
        await sitemapApi.createSitemapConfig(siteId, values as CreateSitemapConfigDto)
        message.success('사이트맵 설정이 추가되었습니다.')
      }

      setModalVisible(false)
      await loadSitemapConfigs()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveIndexingConfig = async (values: any) => {
    try {
      setLoading(true)

      const config: IndexingConfig = {
        mode: 'fromDate',
        startDate: values.startDate ? dayjs(values.startDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      }

      await sitemapApi.updateIndexingConfig(siteId, config)
      setIndexingConfig(config)
      setIndexingModalVisible(false)
      message.success('색인 기준 설정이 저장되었습니다.')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleManualParse = async () => {
    try {
      setParsing(true)
      const result = await sitemapApi.parseSitemap(siteId)
      message.success(result.message || '사이트맵 파싱이 완료되었습니다.')
      await loadSitemapConfigs() // 설정 목록 새로고침
    } catch (err) {
      message.error(err instanceof Error ? err.message : '파싱 중 오류가 발생했습니다.')
    } finally {
      setParsing(false)
    }
  }

  const formatLastParsed = (dateString?: string) => {
    if (!dateString) return '파싱된 적 없음'
    return new Date(dateString).toLocaleString('ko-KR')
  }

  const getSitemapTypeLabel = (type: string) => {
    const found = SITEMAP_TYPES.find(t => t.value === type)
    return found ? found.label : type
  }

  const getIndexingConfigDescription = () => {
    return `${indexingConfig.startDate || '날짜 미설정'} 이후 글 색인`
  }

  if (loading && configs.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <LoadingOutlined style={{ fontSize: '24px' }} />
          <div style={{ marginTop: '8px' }}>로딩 중...</div>
        </div>
      </Card>
    )
  }

  return (
    <>
      {/* 색인 기준 설정 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>색인 기준 설정</span>
          </Space>
        }
        style={{ marginBottom: '16px' }}
        extra={
          <Button type="primary" onClick={() => setIndexingModalVisible(true)}>
            설정 변경
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>현재 설정: </Text>
            <Text>{getIndexingConfigDescription()}</Text>
          </div>
          <Text type="secondary">
            이 설정은 사이트맵에서 색인할 글의 범위를 결정합니다. 블로그에 글이 많은 경우 최근 글만 색인하는 것을
            권장합니다.
          </Text>
        </Space>
      </Card>

      {/* 사이트맵 설정 */}
      <Card
        title={
          <Space>
            <GlobalOutlined />
            <span>사이트맵 설정</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleManualParse}
              loading={parsing}
              disabled={configs.length === 0}
            >
              사이트맵 색인
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddConfig}>
              사이트맵 추가
            </Button>
          </Space>
        }
      >
        {error && <Alert message="오류" description={error} type="error" showIcon style={{ marginBottom: '16px' }} />}

        {success && (
          <Alert message="성공" description={success} type="success" showIcon style={{ marginBottom: '16px' }} />
        )}

        {configs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <GlobalOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <div>등록된 사이트맵이 없습니다.</div>
            <div style={{ fontSize: '12px', marginTop: '8px' }}>사이트맵을 추가하여 자동 색인을 설정하세요.</div>
          </div>
        ) : (
          <List
            dataSource={configs}
            renderItem={config => (
              <List.Item
                actions={[
                  <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => handleEditConfig(config)} />,
                  <Button
                    key="delete"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteConfig(config.id)}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{getSitemapTypeLabel(config.sitemapType)}</Text>
                      <Tag color="blue">{getSitemapTypeLabel(config.sitemapType)}</Tag>
                      {config.isEnabled ? (
                        <Tag color="green">자동색인중</Tag>
                      ) : (
                        <Tag color="default">자동색인 비활성</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Space>
                        <CalendarOutlined />
                        <Text type="secondary">마지막 파싱: {formatLastParsed(config.lastParsed)}</Text>
                      </Space>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 사이트맵 설정 모달 */}
      <Modal
        title={editingConfig ? '사이트맵 수정' : '사이트맵 추가'}
        open={modalVisible}
        onOk={form.submit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveConfig}>
          <Form.Item
            name="name"
            label="사이트맵 설정명"
            rules={[{ required: true, message: '사이트맵 설정명을 입력해주세요' }]}
          >
            <Input placeholder="사이트맵 설정명을 입력하세요" />
          </Form.Item>
          <Form.Item
            name="sitemapType"
            label="사이트맵 타입"
            rules={[{ required: true, message: '사이트맵 타입을 선택해주세요' }]}
          >
            <Select placeholder="사이트맵 타입을 선택하세요">
              {SITEMAP_TYPES.map(type => (
                <Option key={type.value} value={type.value}>
                  <div>
                    <div>{type.label}</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>{type.description}</div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="isEnabled" label="자동색인" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 색인 기준 설정 모달 */}
      <Modal
        title="색인 기준 설정"
        open={indexingModalVisible}
        onOk={indexingForm.submit}
        onCancel={() => setIndexingModalVisible(false)}
        confirmLoading={loading}
        width={500}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">색인할 글의 시작 날짜를 설정하세요. 이 날짜 이후에 작성된 글들만 색인됩니다.</Text>
        </div>
        <Form
          form={indexingForm}
          layout="vertical"
          onFinish={handleSaveIndexingConfig}
          initialValues={{
            startDate: indexingConfig.startDate ? dayjs(indexingConfig.startDate) : dayjs(),
          }}
        >
          <Form.Item
            name="startDate"
            label="시작 날짜"
            rules={[{ required: true, message: '시작 날짜를 선택해주세요' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="시작 날짜를 선택하세요" format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
