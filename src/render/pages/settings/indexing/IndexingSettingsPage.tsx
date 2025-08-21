import React, { useEffect, useState } from 'react'
import {
  Typography,
  Select,
  Form,
  Button,
  Space,
  Card,
  Tabs,
  Modal,
  message,
  Switch,
  Input,
  Tooltip,
  Alert,
} from 'antd'
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getAllSites, createSite, updateSite, deleteSite, Site } from '@render/api/siteConfigApi'
import PageContainer from '@render/components/shared/PageContainer'
import { convertDomainToReadableName, extractDomainFromUrl } from '@render/utils/urlUtils'
import GeneralSettings from '@render/features/settings/indexing/GeneralSettings'
import { SitemapSettings } from '@render/features/settings/indexing/SitemapSettings'
import NaverSettings from '@render/features/settings/indexing/NaverSettings'
import DaumSettings from '@render/features/settings/indexing/DaumSettings'
import GoogleSettings from '@render/features/settings/indexing/GoogleSettings'
import BingSettings from '@render/features/settings/indexing/BingSettings'

const { Title, Text } = Typography
const { TabPane } = Tabs

interface AddSiteFormData {
  name: string
  domain: string
  siteUrl: string
}

const IndexingSettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null)
  const [addSiteForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [settingsForm] = Form.useForm()

  useEffect(() => {
    fetchSites()
  }, [])

  const fixSiteData = (site: Site): Site => {
    // 사이트 이름이 URL로 되어 있는 경우 도메인에서 추출하여 수정
    if (site.name.startsWith('http')) {
      const domain = extractDomainFromUrl(site.name)
      if (domain) {
        return {
          ...site,
          name: convertDomainToReadableName(domain), // 도메인을 읽기 쉬운 이름으로 변환
        }
      }
    }
    return site
  }

  const setFormWithSite = (site: Site) => {
    const fixedSite = fixSiteData(site)
    const defaultNaverConfig = { use: false, selectedNaverAccountId: undefined }
    const defaultDaumConfig = { use: false, siteUrl: '', password: '' }
    const defaultGoogleConfig = { use: false, serviceAccountJson: '' }
    const defaultBingConfig = { use: false, apiKey: '' }
    settingsForm.resetFields()
    settingsForm.setFieldsValue({
      general: {
        name: fixedSite.name,
        domain: fixedSite.domain,
        siteUrl: fixedSite.siteUrl,
      },
      site: {
        isActive: fixedSite.isActive ?? true,
      },
      naver: {
        ...defaultNaverConfig,
        ...fixedSite.naverConfig,
      },
      daum: {
        ...defaultDaumConfig,
        ...fixedSite.daumConfig,
      },
      google: {
        ...defaultGoogleConfig,
        ...fixedSite.googleConfig,
      },
      bing: {
        ...defaultBingConfig,
        ...fixedSite.bingConfig,
      },
    })
  }

  const handleSiteSelect = (site: Site) => {
    const fixedSite = fixSiteData(site)
    setSelectedSite(fixedSite)
    setFormWithSite(fixedSite)
  }

  const fetchSites = async () => {
    try {
      setLoading(true)
      const data = await getAllSites()
      const siteList = Array.isArray(data) ? data.map(fixSiteData) : []
      setSites(siteList)
      if (siteList.length > 0) {
        handleSiteSelect(siteList[0])
      } else {
        setSelectedSite(null)
      }
    } catch (error) {
      console.error('Failed to load sites:', error)
      message.error('사이트 목록을 불러오는데 실패했습니다.')
      setSites([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: any) => {
    if (!selectedSite) return

    try {
      setLoading(true)
      await updateSite(selectedSite.id, {
        name: values.general.name,
        domain: values.general.domain,
        siteUrl: values.general.siteUrl,
        isActive: values.site.isActive,
        naverConfig: values.naver,
        daumConfig: values.daum,
        googleConfig: values.google,
        bingConfig: values.bing,
      })
      message.success('인덱싱 설정이 저장되었습니다.')
      await fetchSites() // 사이트 목록 다시 로드하여 수정된 데이터 반영
    } catch (error) {
      console.error('Failed to save settings:', error)
      message.error('인덱싱 설정 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSite = async (values: AddSiteFormData) => {
    try {
      setLoading(true)
      await createSite({
        ...values,
        isActive: true,
        googleConfig: {
          use: false,
          serviceAccountJson: '',
        },
        naverConfig: {
          use: false,
          selectedNaverAccountId: undefined,
        },
        daumConfig: {
          use: false,
          siteUrl: '',
          password: '',
        },
        bingConfig: {
          use: false,
          apiKey: '',
        },
      })
      message.success('사이트가 추가되었습니다')
      setIsModalVisible(false)
      addSiteForm.resetFields()
      await fetchSites()
    } catch (error) {
      console.error('Failed to create site:', error)
      message.error('사이트 추가에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSite = async () => {
    if (!siteToDelete) return

    try {
      setLoading(true)
      await deleteSite(siteToDelete.id)
      message.success('사이트가 삭제되었습니다')
      setIsDeleteModalVisible(false)
      setSiteToDelete(null)
      await fetchSites()
    } catch (error) {
      console.error('Failed to delete site:', error)
      message.error('사이트 삭제에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const showDeleteModal = (site: Site) => {
    setSiteToDelete(site)
    setIsDeleteModalVisible(true)
  }

  const handleSiteUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    if (url) {
      const domain = extractDomainFromUrl(url)
      if (domain) {
        addSiteForm.setFieldsValue({ domain })
      }
    }
  }

  const indexingItems = selectedSite
    ? [
        {
          key: 'general',
          label: '일반',
          children: (
            <>
              <Form.Item name={['site', 'isActive']} valuePropName="checked" label="사이트 활성화">
                <Switch />
              </Form.Item>
              <GeneralSettings site={selectedSite} />
            </>
          ),
        },
        {
          key: 'sitemap',
          label: '사이트맵',
          children: <SitemapSettings siteId={selectedSite.id} />,
        },
        {
          key: 'naver',
          label: '네이버',
          children: <NaverSettings site={selectedSite} />,
        },
        {
          key: 'daum',
          label: '다음',
          children: <DaumSettings site={selectedSite} />,
        },
        {
          key: 'google',
          label: '구글',
          children: <GoogleSettings site={selectedSite} />,
        },
        {
          key: 'bing',
          label: '빙',
          children: <BingSettings site={selectedSite} />,
        },
      ]
    : []

  return (
    <PageContainer title="인덱싱 설정">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* 일일 제한 안내 */}
        <Alert
          message="일일 인덱싱 제한 안내"
          description={
            <Space direction="vertical" size="small">
              <Text>각 검색 엔진의 정책입니다 (저희 프로그램 문제가 아닙니다):</Text>
              <Text>• 네이버: 50개/일</Text>
              <Text>• 구글: 200개/일</Text>
              <Text>• 빙: 100개/일</Text>
            </Space>
          }
          type="info"
          showIcon
        />

        {/* 사이트 선택 및 관리 섹션 */}
        <Card title="사이트 관리" className="shadow-sm" style={{ marginBottom: '24px' }}>
          <Space>
            <Select
              style={{ width: 200 }}
              placeholder="사이트 선택"
              value={selectedSite?.id}
              onChange={id => {
                const site = sites.find(s => s.id === id)
                if (site) handleSiteSelect(site)
              }}
              options={
                sites?.map(site => ({
                  label: site.name,
                  value: site.id,
                })) || []
              }
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
              사이트 추가
            </Button>
            {selectedSite && (
              <Button danger icon={<DeleteOutlined />} onClick={() => showDeleteModal(selectedSite)} disabled={loading}>
                사이트 제거
              </Button>
            )}
          </Space>
        </Card>

        {/* 설정 섹션 */}
        {selectedSite ? (
          <Card title="인덱싱 설정" className="shadow-sm">
            <Form form={settingsForm} onFinish={handleSave} disabled={loading} layout="vertical">
              <Tabs items={indexingItems} type="card" />
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  인덱싱 설정 저장
                </Button>
              </Form.Item>
            </Form>
          </Card>
        ) : (
          <Card title="인덱싱 설정" className="shadow-sm">
            <div className="text-center py-8 text-gray-500">사이트를 선택하거나 추가해주세요.</div>
          </Card>
        )}

        <Modal
          title="새 사이트 추가"
          open={isModalVisible}
          onOk={addSiteForm.submit}
          onCancel={() => {
            setIsModalVisible(false)
            addSiteForm.resetFields()
          }}
          confirmLoading={loading}
          width={600}
        >
          <Form form={addSiteForm} layout="vertical" onFinish={handleAddSite}>
            <Form.Item
              name="name"
              label={
                <span>
                  사이트 이름
                  <Tooltip title="관리용 이름으로, 원하는 이름을 자유롭게 입력하세요.">
                    <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true, message: '사이트 이름을 입력해주세요' }]}
            >
              <Input placeholder="예: 내 블로그" />
            </Form.Item>

            <Form.Item
              name="domain"
              label={
                <span>
                  도메인
                  <Tooltip title="사이트 URL을 입력하면 자동으로 추출됩니다.">
                    <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true, message: '도메인을 입력해주세요' }]}
            >
              <Text
                style={{
                  display: 'block',
                  padding: '4px 11px',
                  minHeight: '32px',
                  lineHeight: '24px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  backgroundColor: '#f5f5f5',
                }}
              >
                {Form.useWatch('domain', addSiteForm) || '도메인이 자동으로 추출됩니다'}
              </Text>
            </Form.Item>

            <Form.Item
              name="siteUrl"
              label={
                <span>
                  사이트 URL
                  <Tooltip title="전체 URL을 입력해주세요 (예: https://example.com)">
                    <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
                  </Tooltip>
                </span>
              }
              rules={[
                { required: true, message: '사이트 URL을 입력해주세요' },
                { type: 'url', message: '올바른 URL 형식을 입력해주세요' },
              ]}
            >
              <Input placeholder="예: https://example.com" onChange={handleSiteUrlChange} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="사이트 삭제 확인"
          open={isDeleteModalVisible}
          onOk={handleDeleteSite}
          onCancel={() => {
            setIsDeleteModalVisible(false)
            setSiteToDelete(null)
          }}
          confirmLoading={loading}
          okText="삭제"
          cancelText="취소"
          okButtonProps={{ danger: true }}
        >
          <p>
            <strong>{siteToDelete?.name}</strong> 사이트를 삭제하시겠습니까?
          </p>
          <p className="text-gray-500 text-sm mt-2">
            이 작업은 되돌릴 수 없으며, 해당 사이트의 모든 설정과 데이터가 영구적으로 삭제됩니다.
          </p>
        </Modal>
      </div>
    </PageContainer>
  )
}

export default IndexingSettingsPage
