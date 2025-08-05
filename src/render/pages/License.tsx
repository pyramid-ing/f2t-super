import React, { useEffect, useState } from 'react'
import { Card, Typography, Space, Alert } from 'antd'
import styled from 'styled-components'
import LicenseRegistrationForm from '@render/features/settings/LicenseRegistrationForm'
import { getSettings } from '@render/api/settingsApi'
import { authApi } from '@render/api/authApi'

const { Title, Text } = Typography

const StyledContainer = styled.div`
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
`

const StyledCard = styled(Card)`
  margin-bottom: 16px;
`

const LicensePage: React.FC = () => {
  const [currentMachineId, setCurrentMachineId] = useState<string>('')
  const [currentLicenseKey, setCurrentLicenseKey] = useState<string>('')
  const [licenseCache, setLicenseCache] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializePage = async () => {
      try {
        // 서버에서 기기 ID 가져오기
        const machineIdResponse = await authApi.getMachineId()
        setCurrentMachineId(machineIdResponse.machineId)

        // 현재 설정 가져오기
        const settings = await getSettings()
        setCurrentLicenseKey(settings.licenseKey || '')
        // TODO 라이센스키로
        setLicenseCache(false || null)
      } catch (error) {
        console.error('Error initializing license page:', error)
      } finally {
        setLoading(false)
      }
    }

    initializePage()
  }, [])

  const handleLicenseUpdate = (newLicenseKey: string) => {
    setCurrentLicenseKey(newLicenseKey)
  }

  if (loading) {
    return (
      <StyledContainer>
        <StyledCard>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text>로딩 중...</Text>
          </div>
        </StyledCard>
      </StyledContainer>
    )
  }

  return (
    <StyledContainer>
      <Title level={2}>라이센스 관리</Title>

      <StyledCard>
        <Title level={4}>기기 정보</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            <strong>기기 ID:</strong> {currentMachineId}
          </Text>
          {currentLicenseKey && (
            <Text>
              <strong>등록된 라이센스:</strong> {currentLicenseKey}
            </Text>
          )}
        </Space>
      </StyledCard>

      {licenseCache && (
        <StyledCard>
          <Title level={4}>라이센스 상태</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              message={licenseCache.isValid ? '라이센스 유효' : '라이센스 무효'}
              type={licenseCache.isValid ? 'success' : 'error'}
              showIcon
            />
            {licenseCache.permissions && licenseCache.permissions.length > 0 && (
              <div>
                <Text strong>권한 목록:</Text>
                <ul style={{ marginTop: 8 }}>
                  {licenseCache.permissions.map((permission: string, index: number) => (
                    <li key={index}>
                      <Text code>{permission}</Text>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {licenseCache.expiresAt && (
              <Text>
                <strong>만료일:</strong> {new Date(licenseCache.expiresAt).toLocaleString()}
              </Text>
            )}
          </Space>
        </StyledCard>
      )}

      <LicenseRegistrationForm machineId={currentMachineId} onLicenseUpdate={handleLicenseUpdate} />
    </StyledContainer>
  )
}

export default LicensePage
