import { Button, Upload, message } from 'antd'
import React, { useState } from 'react'
import { InboxOutlined } from '@ant-design/icons'
import { workflowApi } from '../../api'

const Posting: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<any[]>([])
  const [isPosting, setIsPosting] = useState(false)

  const handleFileUpload = async (file: File) => {
    setIsPosting(true)
    try {
      const response = await workflowApi.registerWorkflow(file)
      console.log('Upload successful:', response)
      message.success('엑셀 파일이 성공적으로 업로드되었습니다.')
    } catch (error) {
      console.error('Error uploading the file:', error)
      message.error('파일 업로드에 실패했습니다.')
    } finally {
      setIsPosting(false)
    }
  }

  const handleStartPosting = () => {
    if (file) {
      handleFileUpload(file)
    } else {
      message.warning('먼저 엑셀 파일을 선택해주세요.')
    }
  }

  const handleBeforeUpload = (file: File) => {
    console.log('업로드 전 파일:', file) // 디버깅용

    // 파일 타입 검증
    const isValidType =
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // xlsx
      file.type === 'application/vnd.ms-excel' || // xls
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')

    if (!isValidType) {
      message.error('xlsx 또는 xls 파일만 업로드 가능합니다.')
      return false
    }

    // 파일 크기 검증 (10MB 제한)
    const isLt10M = file.size / 1024 / 1024 < 10
    if (!isLt10M) {
      message.error('파일 크기는 10MB를 초과할 수 없습니다.')
      return false
    }

    setFile(file)
    setFileList([
      {
        uid: '-1',
        name: file.name,
        status: 'done',
        originFileObj: file,
      },
    ])
    message.success(`${file.name} 파일이 선택되었습니다.`)
    console.log('파일 설정 완료:', file) // 디버깅용

    return false // 자동 업로드 방지
  }

  const handleRemove = (file: any) => {
    console.log('파일 제거:', file) // 디버깅용
    setFile(null)
    setFileList([])
    message.info('선택된 파일이 제거되었습니다.')
    return true
  }

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          marginBottom: 16,
          padding: 16,
          backgroundColor: '#f6f8fa',
          borderRadius: 8,
          border: '1px solid #e1e4e8',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>📋 엑셀 파일 형식</h4>
        <p style={{ margin: 0, fontSize: '14px', color: '#586069' }}>엑셀 파일은 다음 컬럼을 포함해야 합니다:</p>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '14px', color: '#586069' }}>
          <li>
            <strong>제목</strong>: 블로그 포스트 제목
          </li>
          <li>
            <strong>내용</strong>: 블로그 포스트 내용 (간단한 설명)
          </li>
          <li>
            <strong>예약날짜</strong>: 발행 예정일 (YYYY-MM-DD HH:mm 형식, 선택사항)
          </li>
          <li>
            <strong>라벨</strong>: 블로그 카테고리/태그 (쉼표로 구분, 선택사항)
          </li>
          <li>
            <strong>블로거 ID</strong>: 특정 블로거 ID (선택사항, 비워두면 기본 블로거 사용)
          </li>
        </ul>
        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6a737d' }}>
          예시: 라벨에 "기술,프로그래밍,웹개발" 입력 시 블로그에 해당 카테고리가 자동으로 설정됩니다.
        </p>
      </div>

      <Upload.Dragger
        accept=".xlsx,.xls"
        multiple={false}
        maxCount={1}
        beforeUpload={handleBeforeUpload}
        onRemove={handleRemove}
        fileList={fileList}
        style={{ marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">여기를 클릭하거나 엑셀 파일을 드래그하여 업로드하세요</p>
        <p className="ant-upload-hint">xlsx, xls 파일만 지원됩니다. (최대 10MB)</p>
      </Upload.Dragger>

      <Button type="primary" onClick={handleStartPosting} loading={isPosting} disabled={!file} block size="large">
        {isPosting ? '포스팅 중...' : '포스팅 작업등록'}
      </Button>
    </div>
  )
}

export default Posting
