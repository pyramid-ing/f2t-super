import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Table, Modal, message, Switch, Space, Popconfirm, Tag, Select } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { googleBlogApi, googleOAuthApi, startGoogleLogin } from '../../api'

interface GoogleBlog {
  id: string
  name: string
  description?: string
  bloggerBlogId: string
  isDefault: boolean
  oauth: {
    id: string
    name: string
    description?: string
  }
}

interface GoogleOAuth {
  id: string
  name: string
  description?: string
  email: string
  createdAt: string
  updatedAt: string
}

interface BloggerBlog {
  kind: 'blogger#blog'
  id: string
  name: string
  description?: string
  published: string
  updated: string
  url: string
  selfLink: string
  posts?: {
    totalItems: number
    selfLink: string
  }
  pages?: {
    totalItems: number
    selfLink: string
  }
  locale?: {
    language: string
    country?: string
    variant?: string
  }
}

const GoogleBlogSettingsForm: React.FC = () => {
  const [blogs, setBlogs] = useState<GoogleBlog[]>([])
  const [oauthAccounts, setOauthAccounts] = useState<GoogleOAuth[]>([])
  const [bloggerBlogs, setBloggerBlogs] = useState<BloggerBlog[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingBlog, setEditingBlog] = useState<GoogleBlog | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [form] = Form.useForm()

  // OAuth 계정 목록 로드
  const loadOAuthAccounts = async () => {
    try {
      const accounts = await googleOAuthApi.getOAuthAccounts()
      setOauthAccounts(accounts)
    } catch (error: any) {
      console.error('OAuth 계정 목록 로드 실패:', error)
      setOauthAccounts([])
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [blogsData, oauthData] = await Promise.all([googleBlogApi.getGoogleBlogList(), loadOAuthAccounts()])
      setBlogs(blogsData)
    } catch (error: any) {
      message.error('데이터 로드에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  // Google 로그인 상태 확인
  const checkLoginStatus = async () => {
    try {
      const status = await googleOAuthApi.getOAuthStatus()
      if (status.isLoggedIn) {
        setIsLoggedIn(true)
        setUserInfo(status.userInfo)
        // Blogger 목록 로드
        await loadBloggerBlogs()
      } else {
        setIsLoggedIn(false)
        setUserInfo(null)
        setBloggerBlogs([])
      }
    } catch (error) {
      setIsLoggedIn(false)
      setUserInfo(null)
      setBloggerBlogs([])
    }
  }

  // Blogger 목록 로드
  const loadBloggerBlogs = async () => {
    try {
      const response = await googleBlogApi.getUserBlogs()
      console.log('Blogger 응답:', response) // 디버깅용

      // 응답 구조에 따라 items 배열 추출
      if (response && response.blogs && response.blogs.items && Array.isArray(response.blogs.items)) {
        setBloggerBlogs(response.blogs.items)
      } else if (response && response.items && Array.isArray(response.items)) {
        setBloggerBlogs(response.items)
      } else {
        console.warn('예상하지 못한 응답 구조:', response)
        setBloggerBlogs([])
      }
    } catch (error: any) {
      console.error('Blogger 목록 로드 실패:', error)
      setBloggerBlogs([])
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      // Google 로그인 시작 (고정된 Client ID 사용)
      const clientId = '365896770281-rrr9tqujl2qvgsl2srdl8ccjse9dp86t.apps.googleusercontent.com'

      startGoogleLogin(clientId)

      // 로그인 상태 확인을 위한 폴링
      const checkInterval = setInterval(async () => {
        try {
          const status = await googleOAuthApi.getOAuthStatus()
          if (status.isLoggedIn) {
            setIsLoggedIn(true)
            setUserInfo(status.userInfo)
            await loadBloggerBlogs()
            // OAuth 계정 목록 새로고침
            await loadOAuthAccounts()
            clearInterval(checkInterval)
            message.success('Google 계정이 추가되었습니다.')
          }
        } catch (error) {
          // 에러 무시하고 계속 확인
        }
      }, 2000)

      // 30초 후 폴링 중단
      setTimeout(() => {
        clearInterval(checkInterval)
      }, 30000)
    } catch (error: any) {
      message.error('Google 로그인 시작에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddBlog = async () => {
    setEditingBlog(null)
    form.resetFields()
    setBloggerBlogs([]) // 블로그 목록도 초기화
    setModalVisible(true)
    // 모달 열 때 OAuth 계정 목록 로드
    await loadOAuthAccounts()
  }

  const handleEditBlog = (blog: GoogleBlog) => {
    setEditingBlog(blog)
    form.setFieldsValue({
      name: blog.name,
      description: blog.description,
      isDefault: blog.isDefault,
    })
    setModalVisible(true)
  }

  const handleDeleteBlog = async (blogId: string) => {
    try {
      await googleBlogApi.deleteGoogleBlog(blogId)
      message.success('블로그가 삭제되었습니다.')
      loadData()
    } catch (error: any) {
      // 구체적인 에러 메시지 처리
      if (error.response?.data?.errorCode) {
        const errorCode = error.response.data.errorCode
        const errorMessage = error.response.data.message || '알 수 없는 오류'

        switch (errorCode) {
          case 'GOOGLE_BLOG_NO_DEFAULT':
            message.error('기본 블로그는 삭제할 수 없습니다. 최소 1개의 블로그가 필요합니다.')
            break
          case 'GOOGLE_BLOG_NOT_FOUND':
            message.error('삭제할 블로그를 찾을 수 없습니다.')
            break
          default:
            message.error('블로그 삭제에 실패했습니다: ' + errorMessage)
        }
      } else {
        message.error('블로그 삭제에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
      }
    }
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()

      if (editingBlog) {
        await googleBlogApi.updateGoogleBlog(editingBlog.id, values)
        message.success('블로그가 수정되었습니다.')
      } else {
        // 새 블로그 생성 시 OAuth 계정과 Blogger 블로그 선택 필요
        if (!values.oauthId) {
          message.error('Google 계정을 선택해주세요.')
          return
        }

        if (!values.bloggerBlogId) {
          message.error('Blogger 블로그를 선택해주세요.')
          return
        }

        // 선택된 Blogger 블로그 정보 찾기
        const selectedBlog = bloggerBlogs.find(blog => blog.id === values.bloggerBlogId)
        if (!selectedBlog) {
          message.error('선택된 Blogger 블로그 정보를 찾을 수 없습니다.')
          return
        }

        await googleBlogApi.createGoogleBlog({
          oauthId: values.oauthId,
          bloggerBlogName: selectedBlog.name,
          bloggerBlogId: selectedBlog.id,
          name: values.name,
          description: values.description,
          isDefault: values.isDefault,
        })
        message.success('블로그가 추가되었습니다.')
      }

      setModalVisible(false)
      loadData()
    } catch (error: any) {
      // 구체적인 에러 메시지 처리
      if (error.response?.data?.errorCode) {
        const errorCode = error.response.data.errorCode
        const errorMessage = error.response.data.message || '알 수 없는 오류'

        switch (errorCode) {
          case 'GOOGLE_BLOG_NAME_DUPLICATE':
            message.error(`블로그 이름 "${error.response.data.metadata?.name}"이 이미 존재합니다.`)
            break
          case 'GOOGLE_BLOG_NO_DEFAULT':
            message.error('기본 블로그는 삭제할 수 없습니다. 최소 1개의 블로그가 필요합니다.')
            break
          case 'GOOGLE_BLOG_NOT_FOUND':
            message.error('블로그를 찾을 수 없습니다.')
            break
          case 'GOOGLE_BLOG_OAUTH_REQUIRED':
            message.error('Google OAuth 계정이 필요합니다.')
            break
          case 'GOOGLE_BLOG_OAUTH_BLOGGER_DUPLICATE':
            message.error('이미 등록된 Google OAuth 계정과 Blogger 블로그 조합입니다.')
            break
          default:
            message.error('저장에 실패했습니다: ' + errorMessage)
        }
      } else {
        message.error('저장에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
      }
    }
  }

  const columns = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => description || '-',
    },
    {
      title: '블로거 이름',
      dataIndex: 'bloggerBlogName',
      key: 'bloggerBlogName',
    },
    {
      title: '블로거 ID',
      dataIndex: 'bloggerBlogId',
      key: 'bloggerBlogId',
    },
    {
      title: '구글 계정',
      dataIndex: ['oauth', 'email'],
      key: 'oauthName',
    },
    {
      title: '기본 블로그',
      dataIndex: 'isDefault',
      key: 'isDefault',
      render: (isDefault: boolean) => <Tag color={isDefault ? 'green' : 'default'}>{isDefault ? '기본' : '-'}</Tag>,
    },
    {
      title: '작업',
      key: 'actions',
      render: (_: any, record: GoogleBlog) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditBlog(record)}>
            수정
          </Button>
          <Popconfirm
            title="블로그 삭제"
            description="정말로 이 블로그를 삭제하시겠습니까?"
            onConfirm={() => handleDeleteBlog(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Google 블로그 관리</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddBlog}>
          블로그 추가
        </Button>
      </div>

      <Table columns={columns} dataSource={blogs} rowKey="id" loading={loading} pagination={false} />

      <Modal
        title={editingBlog ? '블로그 수정' : '블로그 추가'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          {!editingBlog && (
            <>
              {/* Google 계정 연동 섹션 */}
              <div style={{ marginBottom: '16px' }}>
                <h4>Google 계정 연동</h4>

                {/* OAuth 계정 목록 표시 */}
                {oauthAccounts.length > 0 ? (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
                      등록된 Google 계정 ({oauthAccounts.length}개):
                    </p>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {oauthAccounts.map(account => (
                        <div
                          key={account.id}
                          style={{
                            padding: '8px',
                            margin: '4px 0',
                            backgroundColor: '#f6ffed',
                            border: '1px solid #b7eb8f',
                            borderRadius: '4px',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{account.name}</div>
                              <div style={{ color: '#666', fontSize: '11px' }}>{account.email}</div>
                              <div style={{ color: '#666', fontSize: '11px' }}>
                                {account.description || '설명 없음'}
                              </div>
                              <div style={{ color: '#999', fontSize: '10px' }}>
                                등록일: {new Date(account.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <Button
                              size="small"
                              danger
                              onClick={async () => {
                                try {
                                  await googleOAuthApi.deleteOAuthAccount(account.id)
                                  message.success('Google 계정이 삭제되었습니다.')
                                  await loadOAuthAccounts()
                                } catch (error: any) {
                                  message.error('계정 삭제에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
                                }
                              }}
                            >
                              삭제
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ margin: '0', fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                      등록된 Google 계정이 없습니다.
                    </p>
                  </div>
                )}

                {/* 새 계정 추가 */}
                <div
                  style={{ textAlign: 'center', padding: '20px', border: '1px dashed #d9d9d9', borderRadius: '4px' }}
                >
                  <p style={{ marginBottom: '16px', color: '#666' }}>
                    새로운 Google 계정을 추가하여 Blogger 블로그를 관리할 수 있습니다.
                  </p>
                  <Button type="primary" onClick={handleGoogleLogin} loading={loading}>
                    Google 계정 추가
                  </Button>
                </div>
              </div>

              {/* OAuth 계정 선택 */}
              {oauthAccounts.length > 0 && (
                <Form.Item
                  label="Google 계정 선택"
                  name="oauthId"
                  rules={[{ required: true, message: 'Google 계정을 선택해주세요.' }]}
                >
                  <Select
                    placeholder="Google 계정을 선택하세요"
                    onChange={async value => {
                      // 블로그 선택 초기화
                      form.setFieldsValue({ bloggerBlogId: undefined })

                      // 선택된 계정의 Blogger 블로그 목록 로드
                      if (value) {
                        try {
                          // 선택된 OAuth 계정으로 Blogger 블로그 목록 가져오기
                          const response = await googleBlogApi.getUserBlogsByOAuthId(value)
                          if (response && response.blogs && response.blogs.items) {
                            setBloggerBlogs(response.blogs.items)
                          } else if (response && response.items) {
                            setBloggerBlogs(response.items)
                          } else {
                            setBloggerBlogs([])
                          }
                        } catch (error: any) {
                          console.error('Blogger 블로그 목록 로드 실패:', error)
                          setBloggerBlogs([])
                        }
                      } else {
                        setBloggerBlogs([])
                      }
                    }}
                  >
                    {oauthAccounts.map(account => (
                      <Select.Option key={account.id} value={account.id}>
                        {account.name} - {account.email}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              {/* Blogger 블로그 선택 */}
              {bloggerBlogs.length > 0 && (
                <Form.Item
                  label="Blogger 블로그 선택"
                  name="bloggerBlogId"
                  rules={[{ required: true, message: 'Blogger 블로그를 선택해주세요.' }]}
                >
                  <Select placeholder="Blogger 블로그를 선택하세요">
                    {bloggerBlogs.map(blog => (
                      <Select.Option key={blog.id} value={blog.id}>
                        {blog.name} ({blog.url})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              <Form.Item
                label="관리용 이름"
                name="name"
                rules={[{ required: true, message: '관리용 이름을 입력해주세요.' }]}
              >
                <Input placeholder="블로그 관리용 이름을 입력하세요" />
              </Form.Item>
            </>
          )}

          {/* 수정 모달에서도 이름 필드 표시 */}
          {editingBlog && (
            <Form.Item
              label="관리용 이름"
              name="name"
              rules={[{ required: true, message: '관리용 이름을 입력해주세요.' }]}
            >
              <Input placeholder="블로그 관리용 이름을 입력하세요" />
            </Form.Item>
          )}

          <Form.Item label="설명" name="description">
            <Input.TextArea placeholder="블로그 설명을 입력하세요" rows={3} />
          </Form.Item>

          <Form.Item label="기본 블로그" name="isDefault" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default GoogleBlogSettingsForm
