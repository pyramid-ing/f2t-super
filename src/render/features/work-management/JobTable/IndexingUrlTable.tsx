import { Button, Input, message, Space, Table, Tooltip, Select, Pagination, Tag } from 'antd'
import { createBulkIndexJob, IndexProvider, listIndexes } from '@render/api'
import { useIndexing } from '@render/hooks/useIndexing'
import { useEffect, useState } from 'react'
import googleIcon from '@render/assets/google_icon.png'
import naverIcon from '@render/assets/naver_icon.png'
import daumIcon from '@render/assets/daum_icon.png'
import bingIcon from '@render/assets/bing_icon.png'

interface IndexRow {
  key: string
  url: string
  displayUrl: string
  provider: IndexProvider
  status: string
  errorMsg?: string | null
  indexedAt?: string
  updatedAt: string
}

function decodeUrlForDisplay(url: string): string {
  try {
    return decodeURI(url)
  } catch {
    return url
  }
}

function isFailedStatus(status?: string): boolean {
  return status === 'failed'
}

export default function IndexingUrlTable() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<IndexRow[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const { activeSites, getEnabledProviders, getFilteredStatuses } = useIndexing()
  const [searchFilters, setSearchFilters] = useState({
    q: '',
    status: '',
    provider: '' as IndexProvider | '',
    page: 1,
    pageSize: 15,
  })
  const [total, setTotal] = useState<number>(0)

  async function fetchUrls() {
    setLoading(true)
    try {
      // 새로운 페이지네이션 API 사용 - 검색어 URL 인코딩
      const res = await listIndexes({
        q: searchFilters.q ? encodeURIComponent(searchFilters.q) : '',
        status: searchFilters.status || undefined,
        provider: searchFilters.provider === '' ? undefined : searchFilters.provider,
        page: searchFilters.page,
        pageSize: searchFilters.pageSize,
      })
      const builtRows: IndexRow[] = res.items.map(i => ({
        key: `${i.url}-${i.provider}`,
        url: i.url,
        displayUrl: decodeUrlForDisplay(i.url),
        provider: i.provider,
        status: i.status,
        errorMsg: i.errorMsg,
        indexedAt: i.indexedAt,
        updatedAt: i.updatedAt,
      }))
      setRows(builtRows)
      setTotal(res.total)
    } catch (err: any) {
      message.error(err?.message || 'URL 목록을 불러오지 못했습니다.')
      setRows([])
    }
    setLoading(false)
  }

  useEffect(() => {
    // 초기 로딩 시에만 한 번 실행
    fetchUrls()
  }, []) // 빈 의존성 배열로 변경

  // 검색 필터 변경 시 자동으로 API 호출 (디바운스 적용)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUrls()
    }, 500) // 500ms 딜레이

    return () => clearTimeout(timeoutId)
  }, [searchFilters])

  const filteredRows = rows

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  }

  function selectFailedOnly() {
    const failedKeys = rows.filter(row => isFailedStatus(row.status)).map(row => row.key)
    setSelectedRowKeys(failedKeys)
  }

  async function bulkRetrySelected() {
    if (selectedRowKeys.length === 0) return

    const urlsToRetry = rows.filter(row => selectedRowKeys.includes(row.key)).map(row => row.url)

    try {
      await createBulkIndexJob(urlsToRetry)
      message.success('선택된 URL들의 재요청이 완료되었습니다.')
      fetchUrls()
    } catch (err: any) {
      message.error(err?.message || '재요청에 실패했습니다.')
    }
  }

  async function retrySingle(url: string) {
    try {
      await createBulkIndexJob([url])
      message.success('재요청이 완료되었습니다.')
      fetchUrls()
    } catch (err: any) {
      message.error(err?.message || '재요청에 실패했습니다.')
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'request':
        return '대기'
      case 'pending':
        return '대기'
      case 'processing':
        return '처리중'
      case 'completed':
        return '성공'
      case 'failed':
        return '실패'
      default:
        return status
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'request':
      case 'pending':
        return 'default'
      case 'processing':
        return 'processing'
      case 'completed':
        return 'success'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  function getProviderIcon(provider: IndexProvider) {
    switch (provider) {
      case IndexProvider.GOOGLE:
        return googleIcon
      case IndexProvider.BING:
        return bingIcon
      case IndexProvider.NAVER:
        return naverIcon
      case IndexProvider.DAUM:
        return daumIcon
      default:
        return googleIcon
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Space>
          <span>검색:</span>
          <Input.Search
            allowClear
            placeholder="URL 검색"
            value={searchFilters.q}
            onChange={e => {
              setSearchFilters(prev => ({ ...prev, q: e.target.value, page: 1 }))
            }}
            onSearch={() => {
              fetchUrls()
            }}
            style={{ width: 320 }}
          />
        </Space>
        <Space>
          <span>상태:</span>
          <Select
            value={searchFilters.status}
            onChange={v => {
              setSearchFilters(prev => ({ ...prev, status: v, page: 1 }))
            }}
            style={{ width: 140 }}
            options={[
              { label: '전체', value: '' },
              { label: '요청', value: 'request' },
              { label: '대기', value: 'pending' },
              { label: '처리중', value: 'processing' },
              { label: '성공', value: 'completed' },
              { label: '실패', value: 'failed' },
            ]}
          />
        </Space>
        <Space>
          <span>검색엔진:</span>
          <Select
            value={searchFilters.provider}
            onChange={v => {
              setSearchFilters(prev => ({ ...prev, provider: v, page: 1 }))
            }}
            style={{ width: 140 }}
            options={[
              { label: '전체', value: '' },
              {
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={googleIcon} alt="Google" style={{ width: 16, height: 16 }} />
                    Google
                  </span>
                ),
                value: IndexProvider.GOOGLE,
              },
              {
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={bingIcon} alt="Bing" style={{ width: 16, height: 16 }} />
                    Bing
                  </span>
                ),
                value: IndexProvider.BING,
              },
              {
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={naverIcon} alt="Naver" style={{ width: 16, height: 16 }} />
                    Naver
                  </span>
                ),
                value: IndexProvider.NAVER,
              },
              {
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={daumIcon} alt="Daum" style={{ width: 16, height: 16 }} />
                    Daum
                  </span>
                ),
                value: IndexProvider.DAUM,
              },
            ]}
          />
        </Space>
        <Space>
          <Button onClick={selectFailedOnly}>실패 항목 선택</Button>
          <Button type="primary" onClick={bulkRetrySelected} disabled={selectedRowKeys.length === 0}>
            선택 URL 재요청 ({selectedRowKeys.length}개)
          </Button>
          <Button onClick={fetchUrls}>새로고침</Button>
        </Space>
      </div>

      <Table
        rowKey="key"
        loading={loading}
        dataSource={filteredRows}
        pagination={false}
        rowSelection={rowSelection}
        bordered
        size="middle"
        columns={[
          {
            title: 'URL',
            dataIndex: 'displayUrl',
            render: (text: string, row: IndexRow) => (
              <a
                href={row.url}
                onClick={e => {
                  e.preventDefault()
                  window.electronAPI.openExternal(row.url)
                }}
                target="_blank"
                rel="noreferrer"
              >
                {text}
              </a>
            ),
          },
          {
            title: '검색엔진',
            dataIndex: 'provider',
            width: 120,
            render: (_: any, row: IndexRow) => (
              <img
                src={getProviderIcon(row.provider)}
                alt={row.provider}
                style={{ width: 20, height: 20, display: 'inline-block', verticalAlign: 'middle' }}
              />
            ),
          },
          {
            title: '상태',
            dataIndex: 'status',
            width: 100,
            render: (_: any, row: IndexRow) => (
              <Tag color={getStatusColor(row.status)}>{getStatusText(row.status)}</Tag>
            ),
          },
          {
            title: '오류 메시지',
            dataIndex: 'errorMsg',
            width: 200,
            render: (_: any, row: IndexRow) => {
              // 성공 상태일 때는 에러 메시지 표시하지 않음
              if (row.status === 'completed' || row.status === '성공') return '-'
              if (!row.errorMsg) return '-'
              return (
                <Tooltip title={row.errorMsg}>
                  <span style={{ color: '#ff4d4f', fontSize: '12px' }}>
                    {row.errorMsg.length > 30 ? row.errorMsg.substring(0, 30) + '...' : row.errorMsg}
                  </span>
                </Tooltip>
              )
            },
          },
          {
            title: '액션',
            dataIndex: 'action',
            width: 120,
            render: (_: any, row: IndexRow) => (
              <Button size="small" onClick={() => retrySingle(row.url)}>
                재요청
              </Button>
            ),
          },
        ]}
      />
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Pagination
          current={searchFilters.page}
          pageSize={searchFilters.pageSize}
          total={total}
          showSizeChanger
          onChange={(p, ps) => {
            setSearchFilters(prev => ({ ...prev, page: p, pageSize: ps }))
            fetchUrls() // 페이지 변경 시 즉시 검색
          }}
        />
      </div>
    </div>
  )
}
