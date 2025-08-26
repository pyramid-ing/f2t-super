import React from 'react'
import { Alert, Typography, Card } from 'antd'
import { ChromeOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography

interface ChromeInstallErrorProps {
  errorType: 'not_installed' | 'permission_denied' | 'browser_error'
}

export const ChromeInstallError: React.FC<ChromeInstallErrorProps> = ({ errorType }) => {
  const getErrorContent = () => {
    switch (errorType) {
      case 'not_installed':
        return {
          title: '크롬 브라우저가 설치되어 있지 않습니다',
          message: '이 기능을 사용하려면 Google Chrome이 필요합니다.',
          type: 'error' as const,
          icon: <ChromeOutlined />,
        }
      case 'permission_denied':
        return {
          title: '크롬 브라우저 실행 권한이 없습니다',
          message: '크롬 브라우저를 실행할 권한이 없습니다.',
          type: 'warning' as const,
          icon: <ChromeOutlined />,
        }
      case 'browser_error':
        return {
          title: '브라우저 실행 중 오류가 발생했습니다',
          message: '브라우저를 실행하는 중에 문제가 발생했습니다.',
          type: 'error' as const,
          icon: <ChromeOutlined />,
        }
      default:
        return {
          title: '브라우저 오류',
          message: '브라우저 관련 오류가 발생했습니다.',
          type: 'error' as const,
          icon: <ChromeOutlined />,
        }
    }
  }

  const getSolutionSteps = () => {
    const platform = navigator.platform.toLowerCase()

    if (platform.includes('win')) {
      return [
        '1. https://www.google.com/chrome/ 에서 크롬을 다운로드하여 설치하세요.',
        '2. 설치 후 앱을 재시작하세요.',
        '3. 설치 후에도 문제가 지속되면 관리자 권한으로 앱을 실행해보세요.',
      ]
    } else if (platform.includes('mac')) {
      return [
        '1. https://www.google.com/chrome/ 에서 크롬을 다운로드하여 설치하세요.',
        '2. 설치 후 앱을 재시작하세요.',
        '3. 시스템 환경설정 > 보안 및 개인정보 보호에서 앱 실행을 허용하세요.',
      ]
    } else {
      return [
        '1. 터미널에서 다음 명령어로 설치하세요:',
        '   Ubuntu/Debian: sudo apt install google-chrome-stable',
        '   CentOS/RHEL: sudo yum install google-chrome-stable',
        '2. 또는 https://www.google.com/chrome/ 에서 다운로드하여 설치하세요.',
        '3. 설치 후 앱을 재시작하세요.',
      ]
    }
  }

  const content = getErrorContent()
  const solutionSteps = getSolutionSteps()

  return (
    <Card
      style={{
        margin: '16px 0',
        border: '1px solid #ff4d4f',
        borderRadius: '8px',
      }}
    >
      <Alert
        message={content.title}
        description={content.message}
        type={content.type}
        icon={content.icon}
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div>
        <Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
          해결 방법:
        </Text>
        <div style={{ marginLeft: 16 }}>
          {solutionSteps.map((step, index) => (
            <Paragraph key={index} style={{ marginBottom: 4, fontSize: 13 }}>
              {step}
            </Paragraph>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default ChromeInstallError
