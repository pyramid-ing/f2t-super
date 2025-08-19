import React from 'react'
import { IndexProvider } from '@render/api'
import googleIcon from '@render/assets/google_icon.png'
import naverIcon from '@render/assets/naver_icon.png'
import daumIcon from '@render/assets/daum_icon.png'
import bingIcon from '@render/assets/bing_icon.png'

export interface IndexProviderStatusProps {
  statuses: Partial<Record<IndexProvider, string>>
  iconSize?: number
  gap?: number
}

const providersOrder: IndexProvider[] = [
  IndexProvider.GOOGLE,
  IndexProvider.NAVER,
  IndexProvider.DAUM,
  IndexProvider.BING,
]

function getProviderIcon(provider: IndexProvider): string {
  switch (provider) {
    case IndexProvider.GOOGLE:
      return googleIcon
    case IndexProvider.NAVER:
      return naverIcon
    case IndexProvider.DAUM:
      return daumIcon
    case IndexProvider.BING:
      return bingIcon
  }
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'completed':
      return '#16a34a' // green
    case 'failed':
      return '#dc2626' // red
    case 'processing':
    case 'request':
    case 'pending':
    default:
      return '#9ca3af' // gray
  }
}

const IndexProviderStatus: React.FC<IndexProviderStatusProps> = ({ statuses, iconSize = 16, gap = 6 }) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {providersOrder.map(provider => {
        // statuses에 있는 provider만 표시
        if (!(provider in statuses)) {
          return null
        }

        const status = statuses[provider]
        const color = getStatusColor(status)
        const src = getProviderIcon(provider)
        return (
          <span key={provider} style={{ display: 'inline-flex', alignItems: 'center', marginRight: gap }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 999,
                background: color,
                marginRight: 4,
              }}
            />
            <img
              src={src}
              alt={provider}
              style={{ width: iconSize, height: iconSize, display: 'inline-block', verticalAlign: 'middle' }}
            />
          </span>
        )
      })}
    </div>
  )
}

export default IndexProviderStatus
