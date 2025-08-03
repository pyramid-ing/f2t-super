import { atom, selector } from 'recoil'
import { AppSettings } from '@render/types/settings'

// 기본 설정값
const defaultSettings: AppSettings = {
  aiProvider: 'gemini',
  adEnabled: false,
  thumbnailEnabled: false,
  linkEnabled: false,
  youtubeEnabled: false,
  imageType: 'pixabay',
  thumbnailFontSize: 24,
  thumbnailTextColor: '#000000',
  thumbnailFontFamily: 'Arial',
  googleTokenExpiry: 0,
}

// 설정 상태 atom
export const settingsState = atom<AppSettings>({
  key: 'settingsState',
  default: defaultSettings,
})

// 로딩 상태 atom
export const settingsLoadingState = atom<boolean>({
  key: 'settingsLoadingState',
  default: false,
})

// 에러 상태 atom
export const settingsErrorState = atom<string | null>({
  key: 'settingsErrorState',
  default: null,
})

// 설정 저장 중 상태 atom
export const settingsSavingState = atom<boolean>({
  key: 'settingsSavingState',
  default: false,
})

// AI 설정만 선택하는 selector
export const aiSettingsSelector = selector({
  key: 'aiSettingsSelector',
  get: ({ get }) => {
    const settings = get(settingsState)
    return {
      aiProvider: settings.aiProvider,
    }
  },
})
