import React, { useEffect } from 'react'
import { useSettings } from '@render/hooks/useSettings'

interface SettingsInitializerProps {
  children: React.ReactNode
}

const SettingsInitializer: React.FC<SettingsInitializerProps> = ({ children }) => {
  const { loadSettings, error } = useSettings()

  useEffect(() => {
    // 앱 시작 시 설정 로드
    loadSettings().catch(error => {
      console.error('Failed to load initial settings:', error)
    })
  }, [])

  return <>{children}</>
}

export default SettingsInitializer
