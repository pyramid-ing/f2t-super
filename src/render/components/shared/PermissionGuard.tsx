import React from 'react'
import { Alert, Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '@render/hooks/usePermissions'
import { Permission } from '@render/types/permissions'

interface PermissionGuardProps {
  children: React.ReactNode
  permissions: Permission[]
  fallbackPath?: string
  showAlert?: boolean
  alertMessage?: string
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permissions,
  fallbackPath = '/license',
  showAlert = false,
  alertMessage = '이 기능을 사용하려면 추가 권한이 필요합니다.',
}) => {
  const { canAccessAll, isLoading, isLicenseValid } = usePermissions()
  const navigate = useNavigate()

  // 라이센스가 유효하지 않은 경우
  if (!isLicenseValid) {
    return (
      <Result
        status="warning"
        title="라이센스가 유효하지 않습니다"
        subTitle="라이센스 페이지에서 라이센스를 등록해주세요."
        extra={
          <Button type="primary" onClick={() => navigate('/license')}>
            라이센스 페이지로 이동
          </Button>
        }
      />
    )
  }

  // 로딩 중인 경우
  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>권한을 확인하는 중...</div>
  }

  // 권한이 없는 경우
  if (!canAccessAll(permissions)) {
    if (showAlert) {
      return (
        <Alert
          message="권한 부족"
          description={alertMessage}
          type="warning"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => navigate(fallbackPath)}>
              라이센스 확인
            </Button>
          }
        />
      )
    }

    return (
      <Result
        status="403"
        title="접근 권한이 없습니다"
        subTitle={alertMessage}
        extra={
          <Button type="primary" onClick={() => navigate(fallbackPath)}>
            라이센스 확인
          </Button>
        }
      />
    )
  }

  // 권한이 있는 경우 자식 컴포넌트 렌더링
  return <>{children}</>
}

export default PermissionGuard
