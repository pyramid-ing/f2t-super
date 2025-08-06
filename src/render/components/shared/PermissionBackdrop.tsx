import React from 'react'
import { Modal, Typography, Button, Space } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { getPermissionLabels } from '@render/utils/permissionLabels'
import { Permission } from '@render/types/permissions'

const { Title, Text } = Typography

const StyledModal = styled(Modal)`
  .ant-modal-content {
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }

  .ant-modal-header {
    background: transparent;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .ant-modal-title {
    color: #ffffff;
  }

  .ant-modal-body {
    color: #ffffff;
  }

  .ant-modal-footer {
    background: transparent;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
`

const IconWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 16px;

  .anticon {
    font-size: 48px;
    color: #ff4d4f;
  }
`

interface PermissionBackdropProps {
  visible: boolean
  onClose: () => void
  requiredPermissions: Permission[]
  featureName?: string
}

const PermissionBackdrop: React.FC<PermissionBackdropProps> = ({
  visible,
  onClose,
  requiredPermissions,
  featureName = '이 기능',
}) => {
  const handleUpgrade = () => {
    // 라이센스 페이지로 이동
    window.location.hash = '#/license'
    onClose()
  }

  return (
    <StyledModal
      title="권한이 필요합니다"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>,
        <Button key="upgrade" type="primary" onClick={handleUpgrade}>
          라이센스 확인
        </Button>,
      ]}
      width={500}
    >
      <IconWrapper>
        <LockOutlined />
      </IconWrapper>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={4} style={{ color: '#ffffff', marginBottom: 8 }}>
            {featureName}을 사용하려면 추가 권한이 필요합니다
          </Title>
          <Text style={{ color: '#cccccc' }}>해당 기능을 이용하기 위해서는 라이센스를 추가로 구매하셔야 합니다.</Text>
        </div>

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

        <div>
          <Text style={{ color: '#cccccc' }}>
            라이센스 페이지에서 현재 라이센스 상태를 확인하고 필요한 권한을 추가로 구매할 수 있습니다.
          </Text>
        </div>
      </Space>
    </StyledModal>
  )
}

export default PermissionBackdrop
