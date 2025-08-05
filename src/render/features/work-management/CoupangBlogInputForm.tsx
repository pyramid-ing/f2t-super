import React, { useState, useEffect } from 'react'
import { Button, Card, Form, Input, Select, Upload, message, Space, Typography } from 'antd'
import { UploadOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { createCoupangBlogPostJob } from '@render/api/coupangBlogPostJobApi'
import { CreateCoupangBlogPostJobRequest } from '@render/types/coupangBlogPostJob'
import { getTistoryAccounts } from '@render/api/tistoryApi'
import { getWordPressAccounts } from '@render/api/wordpressApi'
import { googleBlogApi } from '@render/api/googleBlogApi'
import { TistoryAccount } from '@render/types/tistory'
import { WordPressAccount } from '@render/types/wordpress'
import * as XLSX from 'xlsx'

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
  const [inputMode, setInputMode] = useState<'single' | 'bulk'>('single')
  const [fileList, setFileList] = useState<any[]>([])

  // 계정 목록 상태
  const [tistoryAccounts, setTistoryAccounts] = useState<TistoryAccount[]>([])
  const [wordpressAccounts, setWordpressAccounts] = useState<WordPressAccount[]>([])
  const [googleAccounts, setGoogleAccounts] = useState<any[]>([])
  const [selectedBlogType, setSelectedBlogType] = useState<string>('')

  // 계정 목록 로드
  const loadAccounts = async () => {
    try {
      const [tistoryData, wordpressData, googleData] = await Promise.all([
        getTistoryAccounts(),
        getWordPressAccounts(),
        googleBlogApi.getBloggerAccounts(),
      ])

      setTistoryAccounts(tistoryData)
      setWordpressAccounts(wordpressData)
      setGoogleAccounts(googleData)
    } catch (error: any) {
      console.error('계정 목록 로드 실패:', error)
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
          id: account.id,
          name: account.name,
          description: account.desc,
        }))
      case 'wordpress':
        return wordpressAccounts.map(account => ({
          id: account.id,
          name: account.name,
          description: account.desc,
        }))
      case 'google':
        return googleAccounts.map(account => ({
          id: account.id,
          name: account.name,
          description: account.email,
        }))
      default:
        return []
    }
  }

  const handleSingleSubmit = async (values: any) => {
    setLoading(true)
    try {
      // 블로그 타입에 따른 계정 ID 매핑
      let bloggerAccountId: string | undefined
      let wordpressAccountId: number | undefined
      let tistoryAccountId: number | undefined

      switch (values.blogType) {
        case 'google':
          bloggerAccountId = values.accountId
          break
        case 'wordpress':
          wordpressAccountId = values.accountId ? parseInt(values.accountId) : undefined
          break
        case 'tistory':
          tistoryAccountId = values.accountId ? parseInt(values.accountId) : undefined
          break
      }

      const request: CreateCoupangBlogPostJobRequest = {
        subject: `쿠팡 블로그 포스트`,
        desc: `블로그 포스트 작업`,
        coupangUrl: values.coupangUrl,
        title: `쿠팡 상품 리뷰`,
        content: '자동 생성될 예정입니다.',
        bloggerAccountId,
        wordpressAccountId,
        tistoryAccountId,
      }

      const result = await createCoupangBlogPostJob(request)
      message.success('쿠팡 블로그 작업이 등록되었습니다.')
      form.resetFields()
      onJobCreated?.()
    } catch (error: any) {
      message.error(`작업 등록 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkSubmit = async (values: any) => {
    setLoading(true)
    try {
      const promises = values.items.map(async (item: any) => {
        // 블로그 타입에 따른 계정 ID 매핑
        let bloggerAccountId: string | undefined
        let wordpressAccountId: number | undefined
        let tistoryAccountId: number | undefined

        switch (item.blogType) {
          case 'google':
            bloggerAccountId = item.accountId
            break
          case 'wordpress':
            wordpressAccountId = item.accountId ? parseInt(item.accountId) : undefined
            break
          case 'tistory':
            tistoryAccountId = item.accountId ? parseInt(item.accountId) : undefined
            break
        }

        const request: CreateCoupangBlogPostJobRequest = {
          subject: `쿠팡 블로그 포스트 - ${item.coupangUrl}`,
          desc: `쿠팡 URL: ${item.coupangUrl}의 블로그 포스트 작업`,
          coupangUrl: item.coupangUrl,
          title: `쿠팡 상품 리뷰`,
          content: '자동 생성될 예정입니다.',
          bloggerAccountId,
          wordpressAccountId,
          tistoryAccountId,
        }

        return createCoupangBlogPostJob(request)
      })

      const results = await Promise.all(promises)
      message.success(`${results.length}개의 쿠팡 블로그 작업이 등록되었습니다.`)
      form.resetFields()
      setFileList([])
      onJobCreated?.()
    } catch (error: any) {
      message.error(`작업 등록 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        // Excel 데이터를 폼에 설정
        const items = jsonData.map((row: any) => ({
          coupangUrl: row['쿠팡 URL'] || row['coupangUrl'] || row['URL'] || '',
          blogType: row['블로그 타입'] || row['blogType'] || row['타입'] || 'tistory',
          accountId: row['계정 ID'] || row['accountId'] || row['ID'] || undefined,
        }))

        form.setFieldsValue({ items })
        message.success(`${items.length}개의 항목이 로드되었습니다.`)
      } catch (error) {
        message.error('Excel 파일 읽기에 실패했습니다.')
      }
    }
    reader.readAsArrayBuffer(file)
    return false // 파일 업로드 방지
  }

  const uploadProps = {
    beforeUpload: handleFileUpload,
    fileList,
    onChange: ({ fileList }: any) => setFileList(fileList),
    accept: '.xlsx,.xls',
  }

  return (
    <Card title="쿠팡 블로그 작업 등록" style={{ marginBottom: 16 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button type={inputMode === 'single' ? 'primary' : 'default'} onClick={() => setInputMode('single')}>
          수동 입력 (단일)
        </Button>
        <Button type={inputMode === 'bulk' ? 'primary' : 'default'} onClick={() => setInputMode('bulk')}>
          엑셀 업로드 (벌크)
        </Button>
      </Space>

      {inputMode === 'single' ? (
        <Form form={form} onFinish={handleSingleSubmit} layout="vertical">
          <Form.Item
            name="coupangUrl"
            label="쿠팡 URL"
            rules={[{ required: true, message: '쿠팡 URL을 입력해주세요.' }]}
          >
            <Input placeholder="https://www.coupang.com/vp/products/..." />
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
              <Option value="google">블로그스팟</Option>
            </Select>
          </Form.Item>

          <Form.Item name="accountId" label="계정 선택" rules={[{ required: true, message: '계정을 선택해주세요.' }]}>
            <Select placeholder="계정을 선택하세요" disabled={!selectedBlogType} showSearch optionFilterProp="children">
              {getAccountOptions(selectedBlogType).map(account => (
                <Option key={account.id} value={account.id}>
                  {account.name} {account.description && `(${account.description})`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              작업 등록
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <Form form={form} onFinish={handleBulkSubmit} layout="vertical">
          <Form.Item label="Excel 파일 업로드">
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>Excel 파일 선택</Button>
            </Upload>
            <Text type="secondary">Excel 파일 형식: 쿠팡 URL, 블로그 타입, 계정 ID (선택사항)</Text>
          </Form.Item>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8 }}>
                    <Space align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'coupangUrl']}
                        rules={[{ required: true, message: '쿠팡 URL을 입력해주세요.' }]}
                      >
                        <Input placeholder="쿠팡 URL" style={{ width: 300 }} />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'blogType']}
                        rules={[{ required: true, message: '블로그 타입을 선택해주세요.' }]}
                      >
                        <Select
                          placeholder="블로그 타입"
                          style={{ width: 120 }}
                          onChange={value => {
                            // 블로그 타입 변경 시 계정 ID 초기화
                            const currentItems = form.getFieldValue('items') || []
                            const updatedItems = currentItems.map((item: any, index: number) =>
                              index === name ? { ...item, blogType: value, accountId: undefined } : item,
                            )
                            form.setFieldsValue({ items: updatedItems })
                          }}
                        >
                          <Option value="tistory">티스토리</Option>
                          <Option value="wordpress">워드프레스</Option>
                          <Option value="google">블로그스팟</Option>
                        </Select>
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'accountId']}
                        rules={[{ required: true, message: '계정을 선택해주세요.' }]}
                        key={`account-${name}-${form.getFieldValue('items')?.[name]?.blogType || 'default'}`}
                      >
                        <Select placeholder="계정 선택" style={{ width: 150 }} showSearch optionFilterProp="children">
                          {(() => {
                            const currentBlogType = form.getFieldValue('items')?.[name]?.blogType
                            return getAccountOptions(currentBlogType).map(account => (
                              <Option key={account.id} value={account.id}>
                                {account.name} {account.description && `(${account.description})`}
                              </Option>
                            ))
                          })()}
                        </Select>
                      </Form.Item>

                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  </Card>
                ))}

                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    항목 추가
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              벌크 작업 등록
            </Button>
          </Form.Item>
        </Form>
      )}
    </Card>
  )
}

export default CoupangBlogInputForm
