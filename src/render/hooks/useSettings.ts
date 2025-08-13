import { useCallback } from 'react'
import { useRecoilState } from 'recoil'
import { message } from 'antd'
import { settingsState, settingsLoadingState, settingsErrorState, settingsSavingState } from '@render/atoms/settings'
import { AppSettings } from '@render/types/settings'
import { getSettings, updateSettings as apiUpdateSettings } from '@render/api/settingsApi'

export const useSettings = () => {
  const [settings, setSettings] = useRecoilState(settingsState)
  const [isLoading, setIsLoading] = useRecoilState(settingsLoadingState)
  const [error, setError] = useRecoilState(settingsErrorState)
  const [isSaving, setIsSaving] = useRecoilState(settingsSavingState)

  // 설정 로드
  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getSettings()
      setSettings(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '설정을 불러오는데 실패했습니다.'
      setError(errorMessage)
      message.error(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [setSettings, setIsLoading, setError])

  // 설정 업데이트 (전체)
  const updateSettings = useCallback(
    async (newSettings: AppSettings) => {
      setIsSaving(true)
      setError(null)
      try {
        // 서버에 설정 업데이트
        await apiUpdateSettings(newSettings)

        // 업데이트 후 최신 설정을 다시 가져옴
        const updatedSettings = await getSettings()
        setSettings(updatedSettings)

        message.success('설정이 저장되었습니다.')
        return updatedSettings
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '설정 저장에 실패했습니다.'
        setError(errorMessage)
        message.error(errorMessage)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [setSettings, setIsSaving, setError],
  )

  // 부분 설정 업데이트
  const updatePartialSettings = useCallback(
    async (partialSettings: Partial<AppSettings>) => {
      setIsSaving(true)
      setError(null)
      try {
        // 현재 설정을 가져와서 병합
        const currentSettings = await getSettings()
        const newSettings = { ...currentSettings, ...partialSettings }

        // 서버에 설정 업데이트
        await apiUpdateSettings(newSettings)

        // 업데이트 후 최신 설정을 다시 가져옴
        const updatedSettings = await getSettings()
        setSettings(updatedSettings)

        message.success('설정이 저장되었습니다.')
        return updatedSettings
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '설정 저장에 실패했습니다.'
        setError(errorMessage)
        message.error(errorMessage)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [setSettings, setIsSaving, setError],
  )

  // 로컬 상태만 업데이트 (서버 저장 없이)
  const updateLocalSettings = useCallback(
    (partialSettings: Partial<AppSettings>) => {
      setSettings(prev => ({ ...prev, ...partialSettings }))
    },
    [setSettings],
  )

  // 설정 초기화
  const resetSettings = useCallback(() => {
    setSettings({
      aiProvider: 'gemini',
      adEnabled: false,
      thumbnailEnabled: false,
      linkEnabled: false,
      imageType: 'image-pixabay',
      thumbnailFontSize: 24,
      thumbnailTextColor: '#000000',
      thumbnailFontFamily: 'Arial',
      googleTokenExpiry: 0,
    })
    setError(null)
  }, [setSettings, setError])

  // 에러 클리어
  const clearError = useCallback(() => {
    setError(null)
  }, [setError])

  return {
    // 상태
    settings,
    isLoading,
    error,
    isSaving,

    // 액션
    loadSettings,
    updateSettings,
    updatePartialSettings,
    updateLocalSettings,
    resetSettings,
    clearError,
  }
}

// 특정 설정 섹션만 관리하는 훅들
export const useAISettings = () => {
  const { settings, updatePartialSettings, isLoading, isSaving, error } = useSettings()

  const updateAISettings = useCallback(
    async (aiSettings: { aiProvider?: AppSettings['aiProvider']; geminiApiKey?: string }) => {
      return await updatePartialSettings(aiSettings)
    },
    [updatePartialSettings],
  )

  return {
    aiSettings: {
      aiProvider: settings.aiProvider,
      geminiApiKey: settings.geminiApiKey,
    },
    updateAISettings,
    isLoading,
    isSaving,
    error,
  }
}

export const useGoogleSettings = () => {
  const { settings, updatePartialSettings, isLoading, isSaving, error } = useSettings()

  const updateGoogleSettings = useCallback(
    async (googleSettings: {
      bloggerBlogName?: string
      oauth2AccessToken?: string
      oauth2TokenExpiry?: string
      oauth2RefreshToken?: string
    }) => {
      return await updatePartialSettings(googleSettings)
    },
    [updatePartialSettings],
  )

  return {
    googleSettings: {
      bloggerBlogName: settings.bloggerBlogName,
      oauth2AccessToken: settings.oauth2AccessToken,
      oauth2TokenExpiry: settings.oauth2TokenExpiry,
      oauth2RefreshToken: settings.oauth2RefreshToken,
    },
    updateGoogleSettings,
    isLoading,
    isSaving,
    error,
  }
}

export const useImageSettings = () => {
  const { settings, updatePartialSettings, isLoading, isSaving, error } = useSettings()

  const updateImageSettings = useCallback(
    async (imageSettings: {
      imageType?: 'ai' | 'image-pixabay' | 'none'
      pixabayApiKey?: string
      gcsProjectId?: string
      gcsKeyContent?: string
      gcsBucketName?: string
    }) => {
      const { gcsBucketName, ...rest } = imageSettings as any
      // gcsBucketName이 명시적으로 들어오면 함께 저장
      if (typeof gcsBucketName !== 'undefined') {
        return await updatePartialSettings({ ...rest, gcsBucketName })
      }
      return await updatePartialSettings(rest)
    },
    [updatePartialSettings],
  )

  return {
    imageSettings: {
      imageType: settings.imageType,
      pixabayApiKey: settings.pixabayApiKey,
      gcsKeyContent: settings.gcsKeyContent,
      gcsBucketName: settings.gcsBucketName,
    },
    updateImageSettings,
    isLoading,
    isSaving,
    error,
  }
}

export const useAppSettings = () => {
  const { settings, updatePartialSettings, isLoading, isSaving, error } = useSettings()

  const updateAppSettings = useCallback(
    async (appSettings: {
      adEnabled?: boolean
      adScript?: string
      linkEnabled?: boolean
      youtubeEnabled?: boolean
      blogId?: string
      blogName?: string
      blogUrl?: string
    }) => {
      return await updatePartialSettings(appSettings)
    },
    [updatePartialSettings],
  )

  return {
    appSettings: {
      adEnabled: settings.adEnabled,
      adScript: settings.adScript,
      linkEnabled: settings.linkEnabled,
      youtubeEnabled: settings.youtubeEnabled,
      blogId: settings.blogId,
      blogName: settings.blogName,
      blogUrl: settings.blogUrl,
    },
    updateAppSettings,
    isLoading,
    isSaving,
    error,
  }
}
