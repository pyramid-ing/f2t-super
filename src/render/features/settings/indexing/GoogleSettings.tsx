import React, { useState } from 'react'
import { Form, Input, Switch, Alert, Upload, Button, message } from 'antd'
import { Site } from '@render/api/siteConfigApi'

interface GoogleSettingsProps {
  site: Site
}

const GoogleSettings: React.FC<GoogleSettingsProps> = ({ site }) => {
  const [uploading, setUploading] = useState(false)
  const form = Form.useFormInstance()
  const serviceAccountJson = Form.useWatch(['google', 'serviceAccountJson'])

  const handleServiceAccountUpload = async (file: File) => {
    setUploading(true)
    try {
      const text = await file.text()
      try {
        JSON.parse(text)
      } catch (e) {
        message.error('유효한 JSON 파일이 아닙니다.')
        return false
      }
      form.setFieldValue(['google', 'serviceAccountJson'], text)
      message.success('서비스 계정 키가 정상적으로 업로드되었습니다.')
      return false
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Alert
        message="구글 정책: 200개/일 (저희 프로그램 문제가 아닙니다)"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form.Item name={['google', 'use']} valuePropName="checked" label="구글 인덱싱 사용">
        <Switch />
      </Form.Item>

      <Form.Item
        label="서비스 계정 키 파일 업로드"
        tooltip="Google 서비스 계정 키 파일(.json)을 업로드하세요. 파일 내용만 저장됩니다."
      >
        <Upload
          accept="application/json"
          showUploadList={false}
          beforeUpload={handleServiceAccountUpload}
          disabled={uploading}
        >
          <Button loading={uploading} disabled={uploading}>
            서비스 계정 키 파일 업로드
          </Button>
        </Upload>
      </Form.Item>

      <Form.Item name={['google', 'serviceAccountJson']} label="서비스 계정 JSON">
        <Input.TextArea
          rows={10}
          placeholder="서비스 계정 키 파일 내용이 여기에 표시됩니다. (읽기 전용)"
          value={serviceAccountJson || ''}
          readOnly
          style={{ background: '#f5f5f5' }}
        />
      </Form.Item>
    </>
  )
}

export default GoogleSettings
