import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  message,
  Row,
  Select,
  Space,
  Tabs,
  Typography,
  Upload,
} from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { workflowApi, CoupangBlogWorkflowResponse, CoupangBlogValidationResponse } from '@render/api/workflowApi'
import { getTistoryAccounts } from '@render/api/tistoryApi'
import { getWordPressAccounts } from '@render/api/wordpressApi'
import { googleBlogApi } from '@render/api/googleBlogApi'
import { TistoryAccount } from '@render/types/tistory'
import { WordPressAccount } from '@render/types/wordpress'

const { Title, Text } = Typography
const { Option } = Select

interface AgodaBlogInputFormProps {
  onJobCreated?: () => void
}

interface AccountOption {
  id: string | number
  name: string
  description?: string
}

const AgodaBlogInputForm: React.FC<AgodaBlogInputFormProps> = ({ onJobCreated }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fileList, setFileList] = useState<any[]>([])
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null)
  const [validationResult, setValidationResult] = useState<CoupangBlogValidationResponse | null>(null)
  const [workflowResult, setWorkflowResult] = useState<CoupangBlogWorkflowResponse | null>(null)
  const [excelImmediate, setExcelImmediate] = useState<boolean>(true)

  const [tistoryAccounts, setTistoryAccounts] = useState<TistoryAccount[]>([])
  const [wordpressAccounts, setWordpressAccounts] = useState<WordPressAccount[]>([])
  const [googleAccounts, setGoogleAccounts] = useState<any[]>([])
  const [selectedBlogType, setSelectedBlogType] = useState<string>('')

  const loadAccounts = async () => {
    try {
      const tistoryData = await getTistoryAccounts()
      setTistoryAccounts(tistoryData)
    } catch {
      setTistoryAccounts([])
    }

    try {
      const wordpressData = await getWordPressAccounts()
      setWordpressAccounts(wordpressData)
    } catch {
      setWordpressAccounts([])
    }

    try {
      const bloggerData = await googleBlogApi.getBloggerAccounts()
      setGoogleAccounts(bloggerData)
    } catch {
      setGoogleAccounts([])
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const getAccountOptions = (blogType: string): AccountOption[] => {
    switch (blogType) {
      case 'tistory':
        return tistoryAccounts.map(a => ({ id: a.id, name: a.name, description: a.tistoryUrl }))
      case 'wordpress':
        return wordpressAccounts.map(a => ({ id: a.id, name: a.name, description: a.desc }))
      case 'google_blog':
        return googleAccounts.map((a: any) => ({ id: a.name, name: a.name, description: a.bloggerBlogName }))
      default:
        return []
    }
  }

  const handleSingleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const result = await workflowApi.createAgodaBlogPost({
        agodaUrl: values.agodaUrl,
        blogType: values.blogType,
        accountId: values.accountId,
        scheduledAt: values.scheduledAt,
        category: values.category,
        immediateRequest: values.immediateRequest !== false,
      })
      setWorkflowResult(result)
      if (result.data.success > 0) {
        message.success('아고다 블로그 작업이 등록되었습니다.')
        form.resetFields()
        onJobCreated?.()
      } else {
        message.error('작업 등록에 실패했습니다.')
      }
    } catch (error: any) {
      message.error(`작업 등록 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const submitExcelUpload = async () => {
    if (!selectedExcelFile) {
      message.warning('엑셀 파일을 선택하세요')
      return
    }
    setLoading(true)
    try {
      const result = await workflowApi.uploadAgodaExcelAndCreateJobs(selectedExcelFile, excelImmediate)
      setWorkflowResult(result)
      if (result.data.success > 0) {
        message.success('엑셀 업로드가 완료되었습니다.')
        onJobCreated?.()
        setSelectedExcelFile(null)
        setFileList([])
      } else {
        message.error('엑셀 업로드 처리에 실패했습니다.')
      }
    } catch (error: any) {
      message.error(`엑셀 업로드 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const validateExcel = async (file: File) => {
    setLoading(true)
    try {
      const result = await workflowApi.validateAgodaExcelFile(file)
      setValidationResult(result)
      message.success('검증이 완료되었습니다.')
    } catch (error: any) {
      message.error(`검증 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadSample = async () => {
    try {
      const blob = await workflowApi.downloadAgodaSampleExcel()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'agoda-blog-post-sample.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      message.error(`샘플 다운로드 실패: ${error.message}`)
    }
  }

  return (
    <Card title="아고다 블로그 작업 등록" style={{ marginBottom: 16 }}>
      <Tabs
        defaultActiveKey="manual"
        items={[
          {
            key: 'manual',
            label: '수동 입력',
            children: (
              <Form form={form} layout="vertical" onFinish={handleSingleSubmit} autoComplete="off">
                <Form.Item
                  label="아고다 URL(여러 개는 줄바꿈으로 구분, 최대 5개)"
                  name="agodaUrl"
                  rules={[{ required: true, message: '아고다 URL을 입력해주세요.' }]}
                >
                  <Input.TextArea rows={5} placeholder="최대 5개까지 입력 가능" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="블로그 플랫폼" name="blogType" rules={[{ required: true }]}>
                      <Select placeholder="블로그 플랫폼 선택" onChange={setSelectedBlogType} allowClear>
                        <Option value="tistory">티스토리</Option>
                        <Option value="wordpress">워드프레스</Option>
                        <Option value="google_blog">구글 블로그</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="계정 선택" name="accountId" rules={[{ required: true }]}>
                      <Select placeholder="계정을 선택하세요" allowClear>
                        {getAccountOptions(selectedBlogType).map(opt => (
                          <Option key={opt.id} value={opt.id}>
                            {opt.name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="카테고리" name="category">
                      <Input placeholder="블로그 카테고리 (선택사항)" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="immediateRequest" valuePropName="checked" initialValue={true}>
                  <Checkbox>즉시 요청</Checkbox>
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    작업 등록
                  </Button>
                </Form.Item>

                {workflowResult && (
                  <Alert
                    type="success"
                    message={`총 처리: ${workflowResult.data.totalProcessed}, 성공: ${workflowResult.data.success}, 실패: ${workflowResult.data.failed}`}
                  />
                )}
              </Form>
            ),
          },
          {
            key: 'search',
            label: '검색형',
            children: (
              <Form
                layout="vertical"
                initialValues={{ immediateRequest: true, limit: 3 }}
                onFinish={async (vals: any) => {
                  try {
                    const list = await workflowApi.searchAgoda(vals.keyword, vals.limit)
                    if (!list.length) {
                      message.info('검색 결과가 없습니다.')
                      return
                    }
                    setLoading(true)
                    const payload = {
                      agodaUrl: list.map(v => v.url).join('\n'),
                      blogType: vals.blogType,
                      accountId: vals.accountId,
                      scheduledAt: vals.scheduledAt,
                      category: vals.category,
                      immediateRequest: vals.immediateRequest !== false,
                    }
                    const result = await workflowApi.createAgodaBlogPost(payload)
                    setWorkflowResult(result)
                    if (result.data.success > 0) {
                      message.success('검색 결과로 비교형 작업이 등록되었습니다.')
                      form.resetFields()
                      onJobCreated?.()
                    } else {
                      message.error('작업 등록에 실패했습니다.')
                    }
                  } catch (e: any) {
                    message.error(e.message || '검색 등록 실패')
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                <Form.Item
                  name="keyword"
                  label="아고다 검색어"
                  rules={[{ required: true, message: '검색어를 입력하세요' }]}
                >
                  <Input placeholder="예) 서울 강남 호텔" />
                </Form.Item>
                <Form.Item name="limit" label="비교 수 (최대 5개)" initialValue={3}>
                  <Select options={[1, 2, 3, 4, 5].map(v => ({ value: v, label: `${v}` }))} />
                </Form.Item>
                <Form.Item label="블로그 플랫폼" name="blogType" rules={[{ required: true }]}>
                  <Select placeholder="블로그 플랫폼 선택" onChange={setSelectedBlogType} allowClear>
                    <Option value="tistory">티스토리</Option>
                    <Option value="wordpress">워드프레스</Option>
                    <Option value="google_blog">구글 블로그</Option>
                  </Select>
                </Form.Item>
                <Form.Item name="accountId" label="계정 선택" rules={[{ required: true }]}>
                  <Select
                    placeholder="계정을 선택하세요"
                    disabled={!selectedBlogType}
                    showSearch
                    optionFilterProp="children"
                  >
                    {getAccountOptions(selectedBlogType).map(opt => (
                      <Option key={opt.id} value={opt.id}>
                        {opt.name} {opt.description && `(${opt.description})`}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="scheduledAt" label="예약 날짜">
                  <Input placeholder="YYYY-MM-DD (선택사항)" />
                </Form.Item>
                <Form.Item name="category" label="카테고리">
                  <Input placeholder="블로그 카테고리 (선택사항)" />
                </Form.Item>
                <Form.Item name="immediateRequest" valuePropName="checked">
                  <Checkbox defaultChecked>즉시 요청</Checkbox>
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    검색으로 등록
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'excel',
            label: '엑셀 업로드',
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Button icon={<DownloadOutlined />} onClick={downloadSample}>
                    샘플 다운로드
                  </Button>
                  <Checkbox checked={excelImmediate} onChange={e => setExcelImmediate(e.target.checked)}>
                    즉시 요청
                  </Checkbox>
                </Space>

                <Upload
                  beforeUpload={file => {
                    setSelectedExcelFile(file)
                    setFileList([file])
                    return false
                  }}
                  onRemove={() => {
                    setSelectedExcelFile(null)
                    setFileList([])
                  }}
                  fileList={fileList}
                >
                  <Button icon={<UploadOutlined />}>엑셀 선택</Button>
                </Upload>

                <Space style={{ marginTop: 12 }}>
                  <Button type="primary" onClick={submitExcelUpload} loading={loading} disabled={!selectedExcelFile}>
                    업로드 및 등록
                  </Button>
                  <Button
                    onClick={() => selectedExcelFile && validateExcel(selectedExcelFile)}
                    disabled={!selectedExcelFile}
                  >
                    검증
                  </Button>
                </Space>

                {validationResult && (
                  <div style={{ marginTop: 12 }}>
                    <Title level={5}>검증 결과</Title>
                    <Text>
                      총 {validationResult.data.totalRows}행, 유효 {validationResult.data.validCount}건, 무효{' '}
                      {validationResult.data.invalidCount}건
                    </Text>
                  </div>
                )}
              </>
            ),
          },
        ]}
      />
    </Card>
  )
}

export default AgodaBlogInputForm
