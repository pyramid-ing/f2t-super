import React, { useEffect, useState } from 'react'
import { Button, Space, Card, Typography, Alert } from 'antd'
import { HomeOutlined, CameraOutlined } from '@ant-design/icons'
import { SimpleThumbnailCanvas } from '../components/ThumbnailEditor/ThumbnailCanvas'

const { Title, Text: AntText } = Typography

// 간단한 설정 타입 정의
interface SimpleThumbnailConfig {
  title: string
  subtitle: string
  backgroundImagePath?: string
}

// 메인 썸네일 생성 페이지
const ThumbnailGeneratorPage: React.FC = () => {
  const [config, setConfig] = useState<SimpleThumbnailConfig | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [getDataUrl, setGetDataUrl] = useState<(() => string) | null>(null)

  // URL 파라미터에서 설정 읽기
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const configParam = urlParams.get('config')

    if (configParam) {
      try {
        const parsedConfig = JSON.parse(decodeURIComponent(configParam))
        // 기존 복잡한 설정에서 title, subtitle만 추출
        const simpleConfig: SimpleThumbnailConfig = {
          title: parsedConfig.variables?.제목 || parsedConfig.variables?.title || '제목 없음',
          subtitle: parsedConfig.variables?.부제목 || parsedConfig.variables?.subtitle || '부제목 없음',
          backgroundImagePath: parsedConfig.backgroundImagePath,
        }
        setConfig(simpleConfig)
        console.log('썸네일 설정 로드 완료:', simpleConfig)
      } catch (error) {
        console.error('설정 파싱 오류:', error)
        // 기본값 설정
        setConfig({
          title: '테스트 제목',
          subtitle: '테스트 부제목',
        })
      }
    } else {
      // URL 파라미터가 없으면 기본값
      setConfig({
        title: '테스트 제목',
        subtitle: '테스트 부제목',
      })
    }
  }, [])

  // SimpleThumbnailCanvas가 준비되었을 때 호출
  const handleCanvasReady = (getDataUrlFunc: () => string) => {
    setGetDataUrl(() => getDataUrlFunc)
    setIsReady(true)

    // 전역 함수로 캡쳐 기능 제공
    ;(window as any).captureThumbnail = getDataUrlFunc
    ;(window as any).thumbnailReady = true
    console.log('썸네일 캡쳐 준비 완료')
  }

  // 캡쳐 함수
  const handleCapture = () => {
    if (getDataUrl) {
      try {
        const dataUrl = getDataUrl()
        setCapturedImage(dataUrl)
        console.log('썸네일 캡쳐 성공:', dataUrl.substring(0, 100) + '...')

        // 다운로드 실행
        const link = document.createElement('a')
        link.download = `thumbnail_${Date.now()}.png`
        link.href = dataUrl
        link.click()
      } catch (error) {
        console.error('캡쳐 실패:', error)
      }
    }
  }

  // 홈으로 돌아가기
  const goHome = () => {
    window.location.hash = '/'
  }

  if (!config) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'Arial, sans-serif',
          padding: '20px',
        }}
      >
        <Alert
          message="썸네일 설정을 로드하는 중..."
          description="URL 파라미터에서 설정을 읽어오고 있습니다."
          type="info"
          showIcon
        />
        <Button type="primary" icon={<HomeOutlined />} onClick={goHome} style={{ marginTop: 16 }}>
          대시보드로 돌아가기
        </Button>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f0f0f0',
        padding: '20px',
      }}
    >
      {/* 상단 컨트롤 패널 */}
      <Card style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
              썸네일 생성기 (ThumbnailCanvas 재사용)
            </Title>
            <AntText type="secondary">
              제목: "{config.title}" | 부제목: "{config.subtitle}"
            </AntText>
          </div>

          <Space>
            <Button icon={<CameraOutlined />} onClick={handleCapture} type="primary" size="large" disabled={!isReady}>
              캡쳐 & 다운로드
            </Button>
            <Button icon={<HomeOutlined />} onClick={goHome} size="large">
              홈으로
            </Button>
          </Space>
        </div>

        {/* 상태 표시 */}
        <div style={{ marginTop: '16px' }}>
          {!isReady ? (
            <Alert message="렌더링 중..." type="warning" showIcon />
          ) : (
            <Alert message="캡쳐 준비 완료!" type="success" showIcon />
          )}
        </div>
      </Card>

      {/* 썸네일 캔버스 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            border: '2px solid #ddd',
            borderRadius: '8px',
            backgroundColor: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <SimpleThumbnailCanvas
            title={config.title}
            subtitle={config.subtitle}
            backgroundImagePath={config.backgroundImagePath}
            width={1000}
            height={1000}
            onReady={handleCanvasReady}
          />
        </div>
      </div>

      {/* 디버깅 정보 */}
      <Card title="디버깅 정보" style={{ marginTop: '20px' }}>
        <AntText>
          <pre
            style={{ fontSize: '12px', background: '#f5f5f5', padding: '12px', borderRadius: '4px', overflow: 'auto' }}
          >
            {JSON.stringify(config, null, 2)}
          </pre>
        </AntText>
      </Card>

      {/* 캡쳐된 이미지 미리보기 */}
      {capturedImage && (
        <Card title="캡쳐된 이미지 미리보기" style={{ marginTop: '20px' }}>
          <img
            src={capturedImage}
            alt="캡쳐된 썸네일"
            style={{ maxWidth: '300px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <br />
          <AntText type="secondary">위 이미지가 자동으로 다운로드되었습니다.</AntText>
        </Card>
      )}
    </div>
  )
}

export default ThumbnailGeneratorPage
