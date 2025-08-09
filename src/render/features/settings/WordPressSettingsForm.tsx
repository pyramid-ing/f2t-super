import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Table, Modal, message, Switch, Space, Popconfirm, Tag, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { createWordPressAccount, deleteWordPressAccount, getWordPressAccounts, updateWordPressAccount } from '../../api'
import { WordPressAccount } from '../../types/wordpress'

const WordPressSettingsForm: React.FC = () => {
  const [accounts, setAccounts] = useState<WordPressAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<WordPressAccount | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const accountsData = await getWordPressAccounts()
      setAccounts(accountsData)
    } catch (error: any) {
      message.error('데이터 로드에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddAccount = () => {
    setEditingAccount(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditAccount = (account: WordPressAccount) => {
    setEditingAccount(account)
    form.setFieldsValue({
      name: account.name,
      desc: account.desc,
      url: account.url,
      wpUsername: account.wpUsername,
      apiKey: account.apiKey,
      isDefault: account.isDefault,
      defaultVisibility: account.defaultVisibility === 'private',
    })
    setModalVisible(true)
  }

  const handleDeleteAccount = async (accountId: number) => {
    try {
      await deleteWordPressAccount(accountId)
      message.success('계정이 삭제되었습니다.')
      loadData()
    } catch (error: any) {
      message.error('계정 삭제에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
    }
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()

      if (editingAccount) {
        await updateWordPressAccount(editingAccount.id, {
          ...values,
          defaultVisibility: values.defaultVisibility ? 'private' : 'public',
        })
        message.success('계정이 수정되었습니다.')
      } else {
        await createWordPressAccount({
          ...values,
          defaultVisibility: values.defaultVisibility ? 'private' : 'public',
        })
        message.success('계정이 추가되었습니다.')
      }

      setModalVisible(false)
      loadData()
    } catch (error: any) {
      message.error('저장에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
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
      dataIndex: 'desc',
      key: 'desc',
      render: (desc: string) => desc || '-',
    },
    {
      title: '워드프레스 URL',
      dataIndex: 'url',
      key: 'url',
      render: (url: string) => (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      ),
    },
    {
      title: '사용자명',
      dataIndex: 'wpUsername',
      key: 'wpUsername',
    },
    {
      title: '기본 계정',
      dataIndex: 'isDefault',
      key: 'isDefault',
      render: (isDefault: boolean) => <Tag color={isDefault ? 'green' : 'default'}>{isDefault ? '기본' : '-'}</Tag>,
    },
    {
      title: '작업',
      key: 'actions',
      render: (_: any, record: WordPressAccount) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditAccount(record)}>
            수정
          </Button>
          <Popconfirm
            title="계정 삭제"
            description="정말로 이 계정을 삭제하시겠습니까?"
            onConfirm={() => handleDeleteAccount(record.id)}
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
        <h3>워드프레스 계정 관리</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAccount}>
          계정 추가
        </Button>
      </div>

      <Alert
        message="Application Passwords 설정 안내"
        description={
          <div>
            <p>워드프레스 5.6+ 버전에서는 Application Passwords를 사용합니다.</p>
            <p>1. 워드프레스 관리자 → 사용자 → 사용자 편집</p>
            <p>2. "Application Passwords" 섹션에서 새 비밀번호 생성</p>
            <p>3. 형식: "username:application_password" 또는 "application_password"</p>
          </div>
        }
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: '16px' }}
      />

      <Table columns={columns} dataSource={accounts} rowKey="id" loading={loading} pagination={false} />

      <Modal
        title={editingAccount ? '계정 수정' : '계정 추가'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="계정 이름" name="name" rules={[{ required: true, message: '계정 이름을 입력해주세요.' }]}>
            <Input placeholder="워드프레스 계정 이름을 입력하세요" />
          </Form.Item>

          <Form.Item label="설명" name="desc">
            <Input.TextArea placeholder="계정 설명을 입력하세요" rows={2} />
          </Form.Item>

          <Form.Item
            label="워드프레스 URL"
            name="url"
            rules={[
              { required: true, message: '워드프레스 URL을 입력해주세요.' },
              { type: 'url', message: '올바른 URL을 입력해주세요.' },
            ]}
          >
            <Input placeholder="https://yourblog.com" />
          </Form.Item>

          <Form.Item
            label="워드프레스 사용자명"
            name="wpUsername"
            rules={[{ required: true, message: '워드프레스 사용자명을 입력해주세요.' }]}
          >
            <Input placeholder="워드프레스 사용자명을 입력하세요" />
          </Form.Item>

          <Form.Item
            label="Application Password"
            name="apiKey"
            rules={[{ required: true, message: 'Application Password를 입력해주세요.' }]}
            extra="워드프레스 관리자 → 사용자 → 사용자 편집에서 생성한 Application Password를 입력하세요."
          >
            <Input.Password placeholder="Application Password를 입력하세요" />
          </Form.Item>

          <Form.Item label="기본 계정" name="isDefault" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="기본 발행 상태" name="defaultVisibility" valuePropName="checked">
            <Switch checkedChildren="비공개" unCheckedChildren="공개" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default WordPressSettingsForm
