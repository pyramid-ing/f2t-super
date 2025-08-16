import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  LoginOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd'
import React from 'react'
import { NaverLoginStatus } from '@render/api/naverAccountApi'

const { Title, Text } = Typography

interface NaverLoginListProps {
  loginStatus: NaverLoginStatus | null
  onLogin: () => Promise<void>
  onCloseBrowser: () => Promise<void>
  loading: boolean
  browserOpen: boolean
}

const NaverLoginList: React.FC<NaverLoginListProps> = ({
  loginStatus,
  onLogin,
  onCloseBrowser,
  loading,
  browserOpen,
}) => {
  return (
    <Card
      title={
        <Space>
          <UserOutlined style={{ color: '#03c75a' }} />
          <Title level={5} style={{ margin: 0 }}>
            네이버 로그인 관리
          </Title>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[12, 12]}>
        <Col span={24}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ marginRight: 8, fontSize: '16px' }}>
              {loading ? (
                <LoadingOutlined />
              ) : loginStatus?.isLoggedIn ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <Tag color={loginStatus?.isLoggedIn ? 'success' : 'warning'}>
                {loginStatus?.isLoggedIn ? '로그인됨' : '로그인 필요'}
              </Tag>
            </div>
          </div>

          <Space>
            {browserOpen ? (
              <Button type="primary" danger onClick={onCloseBrowser}>
                로그인 창 닫기
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<LoginOutlined />}
                onClick={onLogin}
                loading={loading}
                disabled={loginStatus?.isLoggedIn}
              >
                네이버 로그인
              </Button>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

export default NaverLoginList
