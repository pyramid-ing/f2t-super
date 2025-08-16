import React, { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, message, Typography, Card } from 'antd'
import { PlusOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import {
  getAllNaverAccounts,
  createNaverAccount,
  deleteNaverAccount,
  NaverAccount,
  CreateNaverAccountDto,
} from '@render/api/naverAccountApi'
import PageContainer from '@render/components/shared/PageContainer'

const { Title } = Typography
const { confirm } = Modal

const NaverAccountPage: React.FC = () => {
  const [accounts, setAccounts] = useState<NaverAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const response = await getAllNaverAccounts()
      setAccounts(response)
    } catch (error) {
      console.error('Failed to load Naver accounts:', error)
      message.error('네이버 계정 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
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
      render: (isActive: boolean) => (isActive ? '예' : '아니오'),
    },
    {
      title: '로그인 상태',
      dataIndex: 'isLoggedIn',
      key: 'isLoggedIn',
      render: (isLoggedIn: boolean) => (isLoggedIn ? '로그인됨' : '로그아웃'),
    },
    {
      title: '마지막 로그인',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: NaverAccount) => (
        <Button type="link" danger onClick={() => showDeleteConfirm(record)}>
          삭제
        </Button>
      ),
    },
  ]

  return (
    <PageContainer title="네이버 계정 관리">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
            계정 추가
          </Button>
        </div>

        <Table dataSource={accounts} columns={columns} rowKey="id" loading={loading} />

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
      </Card>
    </PageContainer>
  )
}

export default NaverAccountPage
