import React, { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, message, Typography, Card, Tag, Space } from 'antd'
import {
  PlusOutlined,
  ExclamationCircleOutlined,
  LoginOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  EditOutlined,
} from '@ant-design/icons'
import {
  getAllNaverAccounts,
  createNaverAccount,
  updateNaverAccount,
  deleteNaverAccount,
  startManualLogin,
  checkLoginStatus,
  checkAllAccountsLoginStatus,
  NaverAccount,
  CreateNaverAccountDto,
} from '@render/api/naverAccountApi'
import PageContainer from '@render/components/shared/PageContainer'

const { Title } = Typography
const { confirm } = Modal

const NaverAccountPage: React.FC = () => {
  const [accounts, setAccounts] = useState<NaverAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [loginLoading, setLoginLoading] = useState<number | null>(null)
  const [statusCheckLoading, setStatusCheckLoading] = useState<number | null>(null)
  const [allStatusCheckLoading, setAllStatusCheckLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<NaverAccount | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const response = await getAllNaverAccounts()
      setAccounts(response)

      // 최초 로드 시에만 로그인 상태 확인
      if (response.length > 0) {
        await checkAllLoginStatusOnLoad()
      }
    } catch (error) {
      console.error('Failed to load Naver accounts:', error)
      message.error('네이버 계정 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const checkAllLoginStatusOnLoad = async () => {
    try {
      setAllStatusCheckLoading(true)
      const results = await checkAllAccountsLoginStatus()

      // 최초 로드 시에는 조용히 상태만 업데이트 (메시지 표시 안함)
      const updatedAccounts = await getAllNaverAccounts()
      setAccounts(updatedAccounts)
    } catch (error) {
      console.error('Failed to check all login status on load:', error)
      // 최초 로드 시에는 에러 메시지 표시 안함
    } finally {
      setAllStatusCheckLoading(false)
    }
  }

  const handleAddAccount = async (values: CreateNaverAccountDto) => {
    try {
      setLoading(true)
      await createNaverAccount({
        ...values,
        isActive: true,
      })
      message.success('네이버 계정이 추가되었습니다')
      setIsModalVisible(false)
      form.resetFields()
      await loadAccounts()
    } catch (error) {
      console.error('Failed to add Naver account:', error)
      message.error('네이버 계정 추가에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleEditAccount = async (values: CreateNaverAccountDto) => {
    if (!editingAccount) return

    try {
      setLoading(true)
      await updateNaverAccount(editingAccount.id, {
        ...values,
        isActive: editingAccount.isActive, // 기존 활성화 상태 유지
      })
      message.success('네이버 계정이 수정되었습니다')
      setIsEditModalVisible(false)
      setEditingAccount(null)
      editForm.resetFields()
      await loadAccounts()
    } catch (error) {
      console.error('Failed to update Naver account:', error)
      message.error('네이버 계정 수정에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const showEditModal = (account: NaverAccount) => {
    setEditingAccount(account)
    editForm.setFieldsValue({
      name: account.name,
      naverId: account.naverId,
      password: '', // 보안상 비밀번호는 빈 값으로 설정
    })
    setIsEditModalVisible(true)
  }

  const handleManualLogin = async (account: NaverAccount) => {
    try {
      setLoginLoading(account.id)
      const result = await startManualLogin(account.id)

      if (result.success) {
        message.success(result.message)
        await loadAccounts() // 계정 목록 새로고침
      } else {
        message.error(result.message)
      }
    } catch (error) {
      console.error('Failed to start manual login:', error)
      message.error('수동 로그인 시작에 실패했습니다')
    } finally {
      setLoginLoading(null)
    }
  }

  const handleCheckLoginStatus = async (account: NaverAccount) => {
    try {
      setStatusCheckLoading(account.id)
      const result = await checkLoginStatus(account.id)

      message.success(`로그인 상태 확인 완료: ${result.message}`)
      await loadAccounts() // 계정 목록 새로고침
    } catch (error) {
      console.error('Failed to check login status:', error)
      message.error('로그인 상태 확인에 실패했습니다')
    } finally {
      setStatusCheckLoading(null)
    }
  }

  const handleCheckAllLoginStatus = async () => {
    try {
      setAllStatusCheckLoading(true)
      const results = await checkAllAccountsLoginStatus()

      const successCount = results.filter(r => r.isLoggedIn).length
      const totalCount = results.length

      message.success(`전체 로그인 상태 확인 완료: ${successCount}/${totalCount}개 계정 로그인됨`)
      await loadAccounts() // 계정 목록 새로고침
    } catch (error) {
      console.error('Failed to check all login status:', error)
      message.error('전체 로그인 상태 확인에 실패했습니다')
    } finally {
      setAllStatusCheckLoading(false)
    }
  }

  const showDeleteConfirm = (account: NaverAccount) => {
    confirm({
      title: '네이버 계정을 삭제하시겠습니까?',
      icon: <ExclamationCircleOutlined />,
      content: `계정 이름: ${account.name} (${account.naverId})`,
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          setLoading(true)
          await deleteNaverAccount(account.id)
          message.success('네이버 계정이 삭제되었습니다')
          await loadAccounts()
        } catch (error) {
          console.error('Failed to delete Naver account:', error)
          message.error('네이버 계정 삭제에 실패했습니다')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const columns = [
    {
      title: '계정 이름',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '네이버 아이디',
      dataIndex: 'naverId',
      key: 'naverId',
    },
    {
      title: '활성화',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => <Tag color={isActive ? 'green' : 'red'}>{isActive ? '활성' : '비활성'}</Tag>,
    },
    {
      title: '로그인 상태',
      dataIndex: 'isLoggedIn',
      key: 'isLoggedIn',
      render: (isLoggedIn: boolean) => (
        <Space>
          {isLoggedIn ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          )}
          <Tag color={isLoggedIn ? 'success' : 'warning'}>{isLoggedIn ? '로그인됨' : '로그인 필요'}</Tag>
        </Space>
      ),
    },
    {
      title: '마지막 로그인',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (date: string) => (date ? new Date(date).toLocaleString() : '-'),
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: NaverAccount) => (
        <Space>
          <Button
            type="primary"
            icon={<LoginOutlined />}
            size="small"
            onClick={() => handleManualLogin(record)}
            loading={loginLoading === record.id}
          >
            로그인
          </Button>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => handleCheckLoginStatus(record)}
            loading={statusCheckLoading === record.id}
          >
            상태확인
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => showEditModal(record)}>
            수정
          </Button>
          <Button type="link" danger size="small" onClick={() => showDeleteConfirm(record)}>
            삭제
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer title="네이버 계정 관리">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
              계정 추가
            </Button>
          </Space>
        </div>

        <Table dataSource={accounts} columns={columns} rowKey="id" loading={loading} />

        {/* 계정 추가 모달 */}
        <Modal
          title="네이버 계정 추가"
          open={isModalVisible}
          onOk={form.submit}
          onCancel={() => {
            setIsModalVisible(false)
            form.resetFields()
          }}
          confirmLoading={loading}
        >
          <Form form={form} layout="vertical" onFinish={handleAddAccount}>
            <Form.Item name="name" label="계정 이름" rules={[{ required: true, message: '계정 이름을 입력해주세요' }]}>
              <Input placeholder="예: 회사 계정" />
            </Form.Item>

            <Form.Item
              name="naverId"
              label="네이버 아이디"
              rules={[{ required: true, message: '네이버 아이디를 입력해주세요' }]}
            >
              <Input placeholder="네이버 아이디" />
            </Form.Item>

            <Form.Item
              name="password"
              label="비밀번호"
              rules={[{ required: true, message: '비밀번호를 입력해주세요' }]}
            >
              <Input.Password placeholder="비밀번호" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 계정 수정 모달 */}
        <Modal
          title="네이버 계정 수정"
          open={isEditModalVisible}
          onOk={editForm.submit}
          onCancel={() => {
            setIsEditModalVisible(false)
            setEditingAccount(null)
            editForm.resetFields()
          }}
          confirmLoading={loading}
        >
          <Form form={editForm} layout="vertical" onFinish={handleEditAccount}>
            <Form.Item name="name" label="계정 이름" rules={[{ required: true, message: '계정 이름을 입력해주세요' }]}>
              <Input placeholder="예: 회사 계정" />
            </Form.Item>

            <Form.Item
              name="naverId"
              label="네이버 아이디"
              rules={[{ required: true, message: '네이버 아이디를 입력해주세요' }]}
            >
              <Input placeholder="네이버 아이디" />
            </Form.Item>

            <Form.Item
              name="password"
              label="비밀번호"
              rules={[{ required: false }]}
              extra="변경하지 않으려면 비워두세요"
            >
              <Input.Password placeholder="새 비밀번호 (선택사항)" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </PageContainer>
  )
}

export default NaverAccountPage
