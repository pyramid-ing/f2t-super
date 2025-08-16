import React, { useEffect, useState } from 'react'
import { Button, Form, Input, message, Modal, Table, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  createNaverAccount,
  CreateNaverAccountDto,
  deleteNaverAccount,
  getAllNaverAccounts,
  NaverAccount,
} from '@render/api/naverAccountApi'

const { Title } = Typography

const NaverAccountManagement: React.FC = () => {
  const [accounts, setAccounts] = useState<NaverAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm<CreateNaverAccountDto>()

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await getAllNaverAccounts()
      console.log(response)
      setAccounts(Array.isArray(response) ? response : [])
    } catch (error) {
      console.error('Failed to load Naver accounts:', error)
      message.error('네이버 계정 목록을 불러오는데 실패했습니다.')
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '이름',
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
      render: (lastLogin: string) => (lastLogin ? new Date(lastLogin).toLocaleString() : '-'),
    },
    {
      title: '작업',
      key: 'action',
      width: '20%',
      render: (_: any, record: NaverAccount) => (
        <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
          삭제
        </Button>
      ),
    },
  ]

  const handleAdd = async (values: CreateNaverAccountDto) => {
    try {
      const response = await createNaverAccount({
        ...values,
        isActive: true,
      })
      message.success('계정이 추가되었습니다.')
      setIsModalVisible(false)
      form.resetFields()
      await fetchAccounts()
    } catch (error) {
      console.error('Failed to add Naver account:', error)
      message.error('계정 추가에 실패했습니다.')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await deleteNaverAccount(id)
      message.success('계정이 삭제되었습니다.')
      fetchAccounts()
    } catch (error) {
      message.error('계정 삭제에 실패했습니다.')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4}>네이버 계정 관리</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
          계정 추가
        </Button>
      </div>

      <Table dataSource={accounts} columns={columns} loading={loading} rowKey="id" />

      <Modal title="네이버 계정 추가" open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
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
          <Form.Item name="password" label="비밀번호" rules={[{ required: true, message: '비밀번호를 입력해주세요' }]}>
            <Input.Password placeholder="비밀번호" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              추가
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NaverAccountManagement
