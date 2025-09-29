import React, { useEffect, useState } from 'react'
import { Switch, Button, Form, Radio, Upload, message, Input } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useAppSettings, useSettings } from '@render/hooks/useSettings'
import { downloadProxySampleExcel, uploadProxyExcel } from '@render/api/settingsApi'
import { getSettings } from '@render/api/settingsApi'

const TistoryGeneralSettings: React.FC = () => {
  const [form] = Form.useForm()
  const { appSettings, updateAppSettings, isLoading, isSaving } = useAppSettings()
  const { loadSettings } = useSettings()
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // 설정 로드 시 폼 초기화
  useEffect(() => {
    form.setFieldsValue({
      ...appSettings,
      ipMode: appSettings.ipMode || 'none',
      proxyChangeMethod: appSettings.proxyChangeMethod || 'random',
      proxies: appSettings.proxies || [],
    })
  }, [appSettings, form])

  // 설정 저장
  const handleSave = async (values: any) => {
    try {
      const proxies = Array.isArray(values.proxies)
        ? values.proxies.map((p: any) => ({
            ip: String(p?.ip || '').trim(),
            port: Number(p?.port),
            id: p?.id ? String(p.id).trim() : undefined,
            pw: p?.pw ? String(p.pw).trim() : undefined,
          }))
        : []

      await updateAppSettings({
        tistoryHeadless: values.tistoryHeadless,
        ipMode: values.ipMode,
        proxyChangeMethod: values.proxyChangeMethod,
        proxies,
      })
    } catch (error) {
      // 에러는 훅에서 처리됨
    }
  }

  const beforeUpload = (file: File) => {
    const isExcel = file.type.includes('sheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    if (!isExcel) {
      message.error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.')
      return Upload.LIST_IGNORE as any
    }
    setExcelFile(file)
    return false
  }

  const handleUploadExcel = async () => {
    if (!excelFile) {
      message.warning('엑셀 파일을 선택해주세요.')
      return
    }
    try {
      setUploading(true)
      const res = await uploadProxyExcel(excelFile)
      if (res.success) {
        message.success(`프록시 ${res.count ?? 0}건이 업로드되었습니다.`)
        // 서버 설정 재로딩 후 폼에 반영
        const settings = await getSettings()
        form.setFieldsValue({
          ...settings,
          ipMode: settings.ipMode || 'none',
          proxyChangeMethod: settings.proxyChangeMethod || 'random',
          proxies: settings.proxies || [],
        })
        setExcelFile(null)
        // 전역 설정 상태도 재조회하여 동기화
        try {
          await loadSettings()
        } catch {}
      } else {
        message.error(res.message || '업로드에 실패했습니다.')
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadSample = async () => {
    try {
      setDownloading(true)
      const blob = await downloadProxySampleExcel()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'proxy-sample.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      message.error(e.message || '예시 엑셀 다운로드 실패')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>티스토리 일반 설정</h3>

      <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
        <Form.Item
          name="tistoryHeadless"
          label="창숨김 모드"
          valuePropName="checked"
          tooltip="창숨김 모드를 사용하면 브라우저 창이 보이지 않고 백그라운드에서 실행됩니다"
        >
          <Switch checkedChildren="창숨김" unCheckedChildren="창보임" />
        </Form.Item>

        <Form.Item name="ipMode" label="아이피 모드" initialValue="none">
          <Radio.Group>
            <Radio value="none">기본</Radio>
            <Radio value="proxy">프록시</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="프록시 변경 방식" name="proxyChangeMethod" initialValue="random">
          <Radio.Group>
            <Radio value="random">랜덤</Radio>
            <Radio value="sequential">순차</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="프록시 목록">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Upload beforeUpload={beforeUpload} maxCount={1} accept=".xlsx,.xls">
              <Button icon={<UploadOutlined />}>엑셀 선택</Button>
            </Upload>
            <Button type="primary" onClick={handleUploadExcel} loading={uploading} disabled={!excelFile}>
              엑셀 업로드로 등록
            </Button>
            <Button onClick={handleDownloadSample} loading={downloading}>
              예시 엑셀 다운로드
            </Button>
          </div>
        </Form.Item>

        {/* 프록시 수동 추가/수정 UI */}
        <Form.List name="proxies">
          {(fields, { add, remove }) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fields.length === 0 && <div style={{ color: '#888' }}>등록된 프록시가 없습니다.</div>}
              {fields.map(field => (
                <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr auto', gap: 8 }}>
                  <Form.Item {...field} name={[field.name, 'ip']} rules={[{ required: true, message: 'IP' }]}>
                    <Input placeholder="IP" />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'port']} rules={[{ required: true, message: 'Port' }]}>
                    <Input type="number" placeholder="Port" />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'id']}>
                    <Input placeholder="ID(옵션)" />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'pw']}>
                    <Input placeholder="PW(옵션)" />
                  </Form.Item>
                  <div>
                    <Button danger onClick={() => remove(field.name)}>
                      삭제
                    </Button>
                  </div>
                </div>
              ))}
              <div>
                <Button onClick={() => add({ ip: '', port: '', id: '', pw: '' })}>프록시 추가</Button>
              </div>
            </div>
          )}
        </Form.List>

        {/* 중복 바인딩 제거: Form.List가 proxies를 관리하므로 숨김 필드 제거 */}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isSaving}>
            설정 저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default TistoryGeneralSettings
