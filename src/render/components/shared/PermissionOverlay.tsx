import React from 'react'
import { Typography, Button, Space, Alert } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { Permission } from '@render/types/permissions'
import { getPermissionLabels } from '@render/utils/permissionLabels'

const { Title, Text } = Typography

const OverlayContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`

const OverlayContent = styled.div`
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
`

const IconWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 24px;

  .anticon {
    font-size: 48px;
    color: #ff4d4f;
  }
`

const FeatureList = styled.div`
  margin: 24px 0;
  text-align: left;

  ul {
    list-style: none;
    padding: 0;
  }

  li {
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    &:last-child {
      border-bottom: none;
    }
  }
`

interface PermissionOverlayProps {
  requiredPermissions: Permission[]
  featureName: string
  features?: string[]
  onClose?: () => void
}

const PermissionOverlay: React.FC<PermissionOverlayProps> = ({
  requiredPermissions,
  featureName,
  features = [],
  onClose,
}) => {
  const handleUpgrade = () => {
    // 라이센스 페이지로 이동
    window.location.hash = '#/license'
    onClose?.()
  }

  const handleClose = () => {
    // 이전 페이지로 돌아가기
    window.history.back()
    onClose?.()
  }

  return (
    <OverlayContainer>
      <OverlayContent>
        <IconWrapper>
          <LockOutlined />
        </IconWrapper>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={3} style={{ color: '#ffffff', marginBottom: 8, textAlign: 'center' }}>
              권한이 필요합니다
            </Title>
            <Text style={{ color: '#cccccc', textAlign: 'center', display: 'block' }}>
              {featureName} 기능을 사용하려면 추가 권한이 필요합니다.
            </Text>
          </div>

          <Alert
            message="라이센스 업그레이드 필요"
            description="해당 기능을 이용하기 위해서는 라이센스를 추가로 구매하셔야 합니다."
            type="warning"
            showIcon
            style={{
              background: '#fff2e8',
              border: '1px solid #ffbb96',
              color: '#d46b08',
            }}
          />

          <div>
            <Text strong style={{ color: '#ffffff' }}>
              필요한 권한:
            </Text>
            <ul style={{ marginTop: 8, color: '#cccccc' }}>
              {getPermissionLabels(requiredPermissions).map((label, index) => (
                <li key={index}>
                  <Text code style={{ color: '#ff7875' }}>
                    {label}
                  </Text>
                </li>
              ))}
            </ul>
          </div>

          {features.length > 0 && (
            <div>
              <Text strong style={{ color: '#ffffff' }}>
                이 권한으로 사용할 수 있는 기능:
              </Text>
              <FeatureList>
                <ul>
                  {features.map((feature, index) => (
                    <li key={index}>
                      <Text style={{ color: '#cccccc' }}>• {feature}</Text>
                    </li>
                  ))}
                </ul>
              </FeatureList>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Space size="large">
              <Button type="primary" size="large" onClick={handleUpgrade}>
                라이센스 확인
              </Button>
              <Button size="large" onClick={handleClose}>
                이전 페이지로
              </Button>
            </Space>
          </div>
        </Space>
      </OverlayContent>
    </OverlayContainer>
  )
}

export default PermissionOverlay
