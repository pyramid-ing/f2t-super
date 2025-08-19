import { useState, useEffect } from 'react'
import { IndexProvider } from '@render/api'
import { getActiveSites, Site } from '@render/api/siteConfigApi'

export interface UseIndexingReturn {
  activeSites: Site[]
  getEnabledProviders: (resultUrl?: string) => IndexProvider[]
  getFilteredStatuses: (statuses: Record<string, string>, resultUrl?: string) => Partial<Record<IndexProvider, string>>
  shouldShowIndexButton: (statuses: Record<string, string>, resultUrl?: string) => boolean
}

export const useIndexing = (): UseIndexingReturn => {
  const [activeSites, setActiveSites] = useState<Site[]>([])

  // 활성화된 provider만 필터링하는 함수
  const getEnabledProviders = (resultUrl?: string): IndexProvider[] => {
    const enabledProviders: IndexProvider[] = []

    // activeSites가 로드되지 않았으면 빈 배열 반환
    if (activeSites.length === 0) {
      return []
    }

    // resultUrl이 있으면 해당 URL의 host와 일치하는 사이트만 필터링
    let targetSites = activeSites
    if (resultUrl) {
      try {
        const url = new URL(resultUrl)
        const host = url.hostname
        targetSites = activeSites.filter(site => site.domain === host)
      } catch (error) {
        // URL 파싱 실패 시 모든 사이트 사용
        targetSites = activeSites
      }
    }

    // 해당 사이트의 설정만 확인
    for (const site of targetSites) {
      if (site.googleConfig?.use) {
        enabledProviders.push(IndexProvider.GOOGLE)
      }
      if (site.bingConfig?.use) {
        enabledProviders.push(IndexProvider.BING)
      }
      if (site.naverConfig?.use) {
        enabledProviders.push(IndexProvider.NAVER)
      }
      if (site.daumConfig?.use) {
        enabledProviders.push(IndexProvider.DAUM)
      }
    }

    // 중복 제거
    return [...new Set(enabledProviders)]
  }

  // 활성화된 provider만 필터링된 statuses 반환
  const getFilteredStatuses = (
    statuses: Record<string, string>,
    resultUrl?: string,
  ): Partial<Record<IndexProvider, string>> => {
    const enabledProviders = getEnabledProviders(resultUrl)
    const filteredStatuses: Partial<Record<IndexProvider, string>> = {}

    enabledProviders.forEach(provider => {
      // API 응답의 키는 대문자 문자열이므로 provider를 대문자로 변환하여 비교
      if (statuses[provider.toUpperCase()]) {
        filteredStatuses[provider] = statuses[provider.toUpperCase()]
      }
    })

    return filteredStatuses
  }

  // 색인 요청 버튼 표시 여부를 결정하는 함수
  const shouldShowIndexButton = (statuses: Record<string, string>, resultUrl?: string): boolean => {
    const enabledProviders = getEnabledProviders(resultUrl)

    // 1. 활성화된 provider가 1개 이상 존재
    if (enabledProviders.length === 0) {
      return false
    }

    // 2. statuses가 빈 객체인 경우 (아직 색인 요청을 하지 않은 경우) - 색인 요청 버튼 표시
    if (Object.keys(statuses).length === 0) {
      return true
    }

    // 3. 필터링된 statuses를 사용하여 모든 활성화된 provider가 completed 상태가 아닌지 확인
    const filteredStatuses = getFilteredStatuses(statuses, resultUrl)
    const isAllCompleted = enabledProviders.every(provider => filteredStatuses[provider] === 'completed')

    return !isAllCompleted
  }

  // 초기 한번 모든 사이트 설정을 로드
  useEffect(() => {
    ;(async () => {
      try {
        const sites = await getActiveSites().catch(() => [])
        setActiveSites(sites || [])
      } catch {}
    })()
  }, [])

  return {
    activeSites,
    getEnabledProviders,
    getFilteredStatuses,
    shouldShowIndexButton,
  }
}
