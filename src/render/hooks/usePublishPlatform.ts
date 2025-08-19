import { useState, useEffect } from 'react'
import { message } from 'antd'
import { getTistoryAccounts } from '@render/api/tistoryApi'
import { getWordPressAccounts } from '@render/api/wordpressApi'
import { googleBlogApi } from '@render/api/googleBlogApi'
import { updateJob } from '@render/api'

export type Platform = 'tistory' | 'wordpress' | 'google_blog'

interface PendingSelection {
  platform?: Platform
  accountId?: number
}

interface UsePublishPlatformProps {
  onDataRefresh: () => void
}

export const usePublishPlatform = ({ onDataRefresh }: UsePublishPlatformProps) => {
  const [tistoryAccounts, setTistoryAccounts] = useState<any[]>([])
  const [wordpressAccounts, setWordpressAccounts] = useState<any[]>([])
  const [bloggerAccounts, setBloggerAccounts] = useState<any[]>([])
  const [pendingSelection, setPendingSelection] = useState<Record<string, PendingSelection>>({})

  // 초기 한번 모든 플랫폼 계정을 캐싱
  useEffect(() => {
    ;(async () => {
      try {
        const [tist, wp, blog] = await Promise.all([
          getTistoryAccounts().catch(() => []),
          getWordPressAccounts().catch(() => []),
          googleBlogApi.getBloggerAccounts().catch(() => []),
        ])
        setTistoryAccounts(tist || [])
        setWordpressAccounts(wp || [])
        setBloggerAccounts(blog || [])
      } catch {}
    })()
  }, [])

  const getOptionsByPlatform = (platform: Platform | ''): { value: number; label: string }[] => {
    switch (platform) {
      case 'tistory':
        return tistoryAccounts.map((a: any) => ({ value: a.id, label: a.name }))
      case 'wordpress':
        return wordpressAccounts.map((a: any) => ({ value: a.id, label: a.name }))
      case 'google_blog':
        return bloggerAccounts.map((a: any) => ({ value: a.id, label: a.name }))
      default:
        return []
    }
  }

  const getCurrentPlatform = (jobData: any): Platform | '' => {
    if (jobData.tistoryAccountId) return 'tistory'
    if (jobData.wordpressAccountId) return 'wordpress'
    if (jobData.bloggerAccountId) return 'google_blog'
    return ''
  }

  const getCurrentAccountId = (jobData: any, platform: Platform | ''): number | undefined => {
    switch (platform) {
      case 'tistory':
        return jobData.tistoryAccountId
      case 'wordpress':
        return jobData.wordpressAccountId
      case 'google_blog':
        return jobData.bloggerAccountId
      default:
        return undefined
    }
  }

  const handlePlatformChange = (jobId: string, platform: Platform) => {
    setPendingSelection(prev => ({
      ...prev,
      [jobId]: { platform, accountId: undefined },
    }))
    message.info('발행 계정을 선택하면 저장됩니다')
  }

  const handleAccountChange = async (jobId: string, jobData: any, effectivePlatform: Platform, accountId: number) => {
    const currentPlatform = getCurrentPlatform(jobData)
    const currentAccountId = getCurrentAccountId(jobData, currentPlatform)

    const next: PendingSelection = {
      platform: effectivePlatform,
      accountId,
    }
    setPendingSelection(prev => ({ ...prev, [jobId]: next }))

    // 플랫폼만 변경된 경우는 업데이트하지 않음
    const platformChanged = effectivePlatform !== currentPlatform
    const accountChanged = accountId !== currentAccountId

    if (platformChanged && !accountChanged) {
      message.info('발행 계정을 선택해야 저장됩니다')
      return
    }

    // 계정이 변경된 경우는 업데이트 (플랫폼 변경 여부와 무관)
    if (accountChanged) {
      try {
        const payload: any = {}
        switch (effectivePlatform) {
          case 'tistory':
            payload.tistoryAccountId = accountId
            payload.wordpressAccountId = null
            payload.bloggerAccountId = null
            break
          case 'wordpress':
            payload.wordpressAccountId = accountId
            payload.tistoryAccountId = null
            payload.bloggerAccountId = null
            break
          case 'google_blog':
            payload.bloggerAccountId = accountId
            payload.tistoryAccountId = null
            payload.wordpressAccountId = null
            break
        }
        await updateJob(jobId, payload)
        message.success('발행 플랫폼/계정이 변경되었습니다')
        onDataRefresh()
      } catch {
        message.error('발행 정보 변경 실패')
      }
    }
  }

  const getPlatformValue = (jobId: string, jobData: any): Platform | '' => {
    const currentPlatform = getCurrentPlatform(jobData)
    return (pendingSelection[jobId]?.platform as Platform | undefined) ?? (currentPlatform as Platform | '')
  }

  const getAccountValue = (jobId: string, jobData: any, effectivePlatform: Platform): number | undefined => {
    const currentPlatform = getCurrentPlatform(jobData)
    const currentAccountId = getCurrentAccountId(jobData, currentPlatform)
    return pendingSelection[jobId]?.accountId ?? (effectivePlatform === currentPlatform ? currentAccountId : undefined)
  }

  return {
    tistoryAccounts,
    wordpressAccounts,
    bloggerAccounts,
    pendingSelection,
    getOptionsByPlatform,
    getCurrentPlatform,
    getCurrentAccountId,
    handlePlatformChange,
    handleAccountChange,
    getPlatformValue,
    getAccountValue,
  }
}
