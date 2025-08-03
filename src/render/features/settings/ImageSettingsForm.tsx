import { Button, Form, Input, message, Radio, Upload } from 'antd'
import React, { useEffect, useState } from 'react'
import { useImageSettings } from '@render/hooks/useSettings'
import { createGcsBucket } from '@render/api/googleStorageApi'
import { CloseCircleOutlined } from '@ant-design/icons'

const { TextArea } = Input

const ImageSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const { imageSettings, updateImageSettings, isLoading, isSaving } = useImageSettings()
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    form.setFieldsValue({
      imageType: imageSettings.imageType || 'pixabay',
      pixabayApiKey: imageSettings.pixabayApiKey || '',
      gcsKeyContent: imageSettings.gcsKeyContent || '',
      gcsBucketName: imageSettings.gcsBucketName || '',
    })
  }, [imageSettings, form])

  const handleSaveSettings = async (values: any) => {
    try {
      // gcsBucketName은 저장 대상에서 제외
      const { gcsBucketName, ...rest } = values
      await updateImageSettings(rest)
    } catch (error) {
      // 에러는 훅에서 처리됨
    }
  }

  // 파일 업로드 핸들러
  const handleGCSKeyUpload = async (file: File) => {
    setUploading(true)
    try {
      const text = await file.text()
      let json
      try {
        json = JSON.parse(text)
      } catch (e) {
        message.error('유효한 JSON 파일이 아닙니다.')
        return false
      }
      // gcsKeyContent 저장
      await updateImageSettings({ gcsKeyContent: text })
      message.success('서비스 계정 키가 정상적으로 업로드되었습니다.')
      return false // 업로드 창 닫기
    } finally {
      setUploading(false)
    }
  }

  const handleCreateBucket = async () => {
    const timestamp = Date.now()
    const bucketName = `winsoft_blog_${timestamp}`
    try {
      const result = await createGcsBucket(bucketName)
      if (result.status === 'success') {
        message.success('버킷이 성공적으로 생성되었습니다.')
        // settings 갱신
        await updateImageSettings({})
      } else {
        message.error(result.error || '버킷 생성에 실패했습니다.')
      }
    } catch (e: any) {
      message.error(e?.message || '버킷 생성 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteBucketName = async () => {
    await updateImageSettings({ gcsBucketName: '' })
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>이미지 설정</h2>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveSettings}
        initialValues={{
          imageType: 'pixabay',
          pixabayApiKey: '',
          gcsKeyContent: '',
        }}
      >
        {/* 이미지 생성 방식 섹션 */}
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 20, marginBottom: 32 }}>
          <h3 style={{ marginTop: 0 }}>이미지 생성 방식</h3>
          <Form.Item
            name="imageType"
            label="이미지 생성 방식"
            tooltip="포스트에 삽입할 이미지를 생성하는 방식을 선택하세요."
          >
            <Radio.Group>
              <Radio value="ai">AI 생성</Radio>
              <Radio value="pixabay">Pixabay 검색</Radio>
              <Radio value="none">사용안함</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="pixabayApiKey"
            label="픽사베이 API키"
            tooltip="픽사베이에서 이미지를 검색하기 위한 API 키를 입력하세요."
          >
            <Input type="password" placeholder="픽사베이 API키 입력" disabled={isLoading} />
          </Form.Item>
        </div>

        {/* 이미지 호스팅 서버(GCS) 섹션 */}
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 20, marginBottom: 32 }}>
          <h3 style={{ marginTop: 0 }}>이미지 호스팅 서버</h3>
          <Form.Item
            label="서비스 계정 키 파일 업로드"
            tooltip="Google Cloud Storage 서비스 계정 키 파일(.json)을 업로드하세요. 파일 내용만 저장되며, 파일 자체는 저장되지 않습니다."
          >
            <Upload
              accept="application/json"
              showUploadList={false}
              beforeUpload={handleGCSKeyUpload}
              disabled={isLoading || uploading}
            >
              <Button loading={uploading} disabled={isLoading || uploading}>
                서비스 계정 키 파일 업로드
              </Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="gcsKeyContent"
            label="서비스 계정 키 파일 내용"
            tooltip="업로드된 서비스 계정 키 파일의 내용을 확인할 수 있습니다. (읽기 전용)"
          >
            <TextArea
              rows={8}
              placeholder="서비스 계정 키 파일 내용이 여기에 표시됩니다."
              value={imageSettings.gcsKeyContent || ''}
              readOnly
              style={{ background: '#f5f5f5' }}
            />
          </Form.Item>
          <Form.Item
            name="gcsBucketName"
            label="GCS 버킷명"
            tooltip="생성된 GCS 버킷명을 확인할 수 있습니다. (읽기 전용)"
          >
            <Input
              value={imageSettings.gcsBucketName || ''}
              readOnly
              style={{ background: '#f5f5f5' }}
              suffix={
                imageSettings.gcsBucketName ? (
                  <CloseCircleOutlined
                    style={{ color: '#ff4d4f', cursor: 'pointer' }}
                    onClick={handleDeleteBucketName}
                  />
                ) : null
              }
            />
          </Form.Item>
        </div>

        {/* 저장 버튼: 폼 전체 하단에 위치 */}
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isSaving}>
            저장
          </Button>
        </Form.Item>

        <Form.Item>
          <Button type="primary" onClick={handleCreateBucket} disabled={!!imageSettings.gcsBucketName}>
            버킷 생성
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default ImageSettingsForm
