import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { usePermissions } from '@render/hooks/usePermissions'
import { Permission } from '@render/types/permissions'
import PermissionGuard from './PermissionGuard'

interface ProtectedRouteProps {
  children: React.ReactNode
  permissions: Permission[]
  fallbackPath?: string
  redirectTo?: string
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permissions,
  fallbackPath = '/license',
  redirectTo,
}) => {
  const { isLicenseValid, isLoading } = usePermissions()
  const location = useLocation()

  // 라이센스가 유효하지 않은 경우
  if (!isLicenseValid && !isLoading) {
    return <Navigate to="/license" state={{ from: location }} replace />
  }

  // 리다이렉트가 지정된 경우
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />
  }

  // 권한 보호
  return (
    <PermissionGuard permissions={permissions} fallbackPath={fallbackPath}>
      {children}
    </PermissionGuard>
  )
}

export default ProtectedRoute
