import React, { useState, useEffect } from 'react'
import { Button, Card, Form, Input, Select, Upload, message, Typography, Alert, Tabs, Space } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { workflowApi, CoupangBlogWorkflowResponse, CoupangBlogValidationResponse } from '@render/api/workflowApi'
import { getTistoryAccounts } from '@render/api/tistoryApi'
import { getWordPressAccounts } from '@render/api/wordpressApi'
import { googleBlogApi } from '@render/api/googleBlogApi'
import { TistoryAccount } from '@render/types/tistory'
import { WordPressAccount } from '@render/types/wordpress'

const { Title, Text } = Typography
const { Option } = Select

interface CoupangBlogInputFormProps {
  onJobCreated?: () => void
}

interface AccountOption {
  id: string | number
  name: string
  description?: string
}

const CoupangBlogInputForm: React.FC<CoupangBlogInputFormProps> = ({ onJobCreated }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fileList, setFileList] = useState<any[]>([])
  const [validationResult, setValidationResult] = useState<CoupangBlogValidationResponse | null>(null)
  const [workflowResult, setWorkflowResult] = useState<CoupangBlogWorkflowResponse | null>(null)

  // 계정 목록 상태
  const [tistoryAccounts, setTistoryAccounts] = useState<TistoryAccount[]>([])
  const [wordpressAccounts, setWordpressAccounts] = useState<WordPressAccount[]>([])
  const [googleAccounts, setGoogleAccounts] = useState<any[]>([])
  const [selectedBlogType, setSelectedBlogType] = useState<string>('')

  // 계정 목록 로드
  const loadAccounts = async () => {
    // 각 API 호출을 개별적으로 처리
    try {
      const tistoryData = await getTistoryAccounts()
      setTistoryAccounts(tistoryData)
    } catch (error: any) {
      console.error('티스토리 계정 목록 로드 실패:', error)
      setTistoryAccounts([])
    }

    try {
      const wordpressData = await getWordPressAccounts()
      setWordpressAccounts(wordpressData)
    } catch (error: any) {
      console.error('워드프레스 계정 목록 로드 실패:', error)
      setWordpressAccounts([])
    }

    try {
      const googleData = await googleBlogApi.getBloggerAccounts()
      setGoogleAccounts(googleData)
    } catch (error: any) {
      console.error('구글 블로거 계정 목록 로드 실패:', error)
      setGoogleAccounts([])
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  // 선택된 블로그 타입에 따른 계정 목록 반환
  const getAccountOptions = (blogType: string): AccountOption[] => {
    switch (blogType) {
      case 'tistory':
        return tistoryAccounts.map(account => ({
          id: account.name, // 워크플로우에서는 name을 사용
          name: account.name,
          description: account.desc,
        }))
      case 'wordpress':
        return wordpressAccounts.map(account => ({
          id: account.name, // 워크플로우에서는 name을 사용
          name: account.name,
          description: account.desc,
        }))
      case 'blogger':
        return googleAccounts.map(account => ({
          id: account.name, // 워크플로우에서는 name을 사용
          name: account.name,
          description: account.bloggerBlogName,
        }))
      default:
        return []
    }
  }

  const handleSingleSubmit = async (values: any) => {
    setLoading(true)
    try {
      // 수동 입력 API 호출
      const result = await workflowApi.createCoupangBlogPost({
        coupangUrl: values.coupangUrl,
        blogType: values.blogType,
        accountId: values.accountId,
        scheduledAt: values.scheduledAt,
        category: values.category,
      })

      setWorkflowResult(result)

      if (result.data.success > 0) {
        message.success('쿠팡 블로그 작업이 등록되었습니다.')
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

  const handleFileUpload = async (file: File) => {
    setLoading(true)
    try {
      // 워크플로우 API 호출
      const result = await workflowApi.uploadExcelAndCreateJobs(file)
      setWorkflowResult(result)

      if (result.data.success > 0) {
        message.success(`${result.data.success}개의 쿠팡 블로그 작업이 등록되었습니다.`)
        form.resetFields()
        setFileList([])
        onJobCreated?.()
      } else {
        message.error('작업 등록에 실패했습니다.')
      }
    } catch (error: any) {
      message.error(`작업 등록 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
    return false // 파일 업로드 방지
  }

  const handleValidateExcel = async (file: File) => {
    try {
      const result = await workflowApi.validateExcelFile(file)
      setValidationResult(result)
      message.success(`검증 완료: 유효 ${result.data.validCount}건, 무효 ${result.data.invalidCount}건`)
    } catch (error: any) {
      message.error(`검증 실패: ${error.message}`)
    }
  }

  const uploadProps = {
    beforeUpload: handleFileUpload,
    fileList,
    onChange: ({ fileList }: any) => setFileList(fileList),
    accept: '.xlsx,.xls',
  }

  return (
    <Card title="쿠팡 블로그 작업 등록" style={{ marginBottom: 16 }}>
      {/* 워크플로우 결과 표시 */}
      {workflowResult && (
        <Alert
          message="워크플로우 완료"
          description={
            <div>
              <p>총 {workflowResult.data.totalProcessed}개 행 처리</p>
              <p>성공: {workflowResult.data.success}개</p>
              <p>실패: {workflowResult.data.failed}개</p>
              {workflowResult.data.errors.length > 0 && (
                <div>
                  <p>
                    <strong>오류 상세:</strong>
                  </p>
                  <ul>
                    {workflowResult.data.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          }
          type={workflowResult.data.failed > 0 ? 'warning' : 'success'}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setWorkflowResult(null)}
        />
      )}

      <Tabs
        items={[
          {
            key: 'single',
            label: '수동 입력',
            children: (
              <Form form={form} onFinish={handleSingleSubmit} layout="vertical">
                <Form.Item
                  name="coupangUrl"
                  label="쿠팡 URL(여러 개는 줄바꿈으로 구분)"
                  rules={[{ required: true, message: '쿠팡 URL을 입력해주세요.' }]}
                  tooltip="여러 상품 비교는 URL을 줄바꿈으로 입력하세요."
                >
                  <Input.TextArea
                    rows={4}
                    placeholder={`https://www.coupang.com/vp/products/...
https://www.coupang.com/vp/products/...`}
                  />
                </Form.Item>

                <Form.Item
                  name="blogType"
                  label="블로그 플랫폼"
                  rules={[{ required: true, message: '블로그 플랫폼을 선택해주세요.' }]}
                >
                  <Select
                    placeholder="블로그 플랫폼 선택"
                    onChange={value => {
                      setSelectedBlogType(value)
                      // 블로그 타입 변경 시 계정 ID 초기화
                      form.setFieldsValue({ accountId: undefined })
                    }}
                  >
                    <Option value="tistory">티스토리</Option>
                    <Option value="wordpress">워드프레스</Option>
                    <Option value="blogger">블로그스팟</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="accountId"
                  label="계정 선택"
                  rules={[{ required: true, message: '계정을 선택해주세요.' }]}
                >
                  <Select
                    placeholder="계정을 선택하세요"
                    disabled={!selectedBlogType}
                    showSearch
                    optionFilterProp="children"
                  >
                    {getAccountOptions(selectedBlogType).map(account => (
                      <Option key={account.id} value={account.id}>
                        {account.name} {account.description && `(${account.description})`}
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

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    작업 등록
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'bulk',
            label: '엑셀 업로드',
            children: (
              <div>
                <Form.Item label="Excel 파일 업로드">
                  <Space>
                    <Upload {...uploadProps}>
                      <Button icon={<UploadOutlined />} loading={loading}>
                        Excel 파일 선택
                      </Button>
                    </Upload>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={async () => {
                        try {
                          const blob = await workflowApi.downloadSampleExcel()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = '쿠팡파트너스_블로그_샘플엑셀.xlsx'
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                        } catch (e: any) {
                          message.error('샘플 엑셀 다운로드 실패')
                        }
                      }}
                    >
                      샘플 엑셀 다운로드
                    </Button>
                  </Space>
                  <Text type="secondary">
                    Excel 파일 형식: 쿠팡url, 발행블로그유형, 발행블로그이름, 예약날짜(선택), 카테고리(선택)
                  </Text>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>
                      <strong>쿠팡url</strong>: 쿠팡 상품 URL
                    </li>
                    <li>
                      <strong>발행블로그유형</strong>: wordpress, tistory, blogger 중 하나
                    </li>
                    <li>
                      <strong>발행블로그이름</strong>:
                      <ul className="ml-4 mt-1">
                        <li>• Blogger: bloggerAccount.name</li>
                        <li>• Tistory: tistoryAccount.name</li>
                        <li>• WordPress: wordpressAccount.name</li>
                      </ul>
                    </li>
                    <li>
                      <strong>예약날짜</strong>: YYYY-MM-DD 형식 (선택사항)
                    </li>
                    <li>
                      <strong>카테고리</strong>: 블로그 카테고리 (선택사항)
                    </li>
                  </ul>
                </Form.Item>
              </div>
            ),
          },
        ]}
      />
    </Card>
  )
}

export default CoupangBlogInputForm
