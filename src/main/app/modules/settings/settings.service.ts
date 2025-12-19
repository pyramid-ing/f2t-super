import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { AppSettings } from './settings.types'
import { BlogType } from '@main/app/modules/job/job.types'
import * as XLSX from 'xlsx'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  public getAiModels(): { defaultModel: string; models: { id: string; label: string }[] } {
    return {
      defaultModel: 'gemini-2.5-pro',
      models: [
        { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro (권장/기본)' },
        { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (빠름)' },
        { id: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite (저비용)' },
      ],
    }
  }

  public async getSettings(): Promise<AppSettings> {
    const settings = await this.prisma.settings.findFirst({
      where: { id: 1 },
    })

    const defaultSettings: AppSettings = {
      aiProvider: 'gemini',
      aiModel: 'gemini-2.5-pro',
      publishType: BlogType.WORDPRESS,
      infoBlogLanguage: 'ko',
      thumbnailEnabled: true, // 기본값을 true로 설정
      tistoryHeadless: true, // 기본값을 창숨김으로 설정
      debugBrowserEnabled: false, // 기본값: 디버그 브라우저 비활성화
    }
    const merged = {
      ...defaultSettings,
      ...(settings?.data as unknown as AppSettings),
    }
    return merged
  }

  public async updateSettings(newSettings: Partial<AppSettings>) {
    const currentSettings = await this.getSettings()
    const mergedSettings = {
      ...currentSettings,
      ...newSettings,
      aiProvider: 'gemini',
      aiModel: newSettings.aiModel ?? currentSettings.aiModel ?? 'gemini-2.5-pro',
    }
    await this.prisma.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        data: mergedSettings,
      },
      update: {
        data: mergedSettings,
      },
    })

    return mergedSettings
  }

  /**
   * 전역 디버그 브라우저 설정에 기반한 Playwright headless 여부 반환
   * - debugBrowserEnabled === true 이면 브라우저 창 보이기(headless=false)
   * - 그 외에는 headless=true
   */
  public async getPlaywrightHeadless(): Promise<boolean> {
    const settings = await this.getSettings()
    const debugEnabled = settings.debugBrowserEnabled === true
    return !debugEnabled
  }

  /**
   * 프록시 목록 엑셀 업로드 처리
   */
  public async importProxiesFromExcel(
    file: Express.Multer.File,
  ): Promise<{ success: boolean; count?: number; message?: string }> {
    if (!file || !file.buffer) {
      return { success: false, message: '파일이 업로드되지 않았습니다.' }
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    const canonicalizeKey = (key: string): string => {
      const raw = String(key).trim()
      const lower = raw.toLowerCase()
      if (lower === 'ip') return 'ip'
      if (lower === 'port') return 'port'
      if (lower === 'id' || lower === 'userid' || lower === 'user') return 'id'
      if (lower === 'pw' || lower === 'password' || lower === 'pass') return 'pw'
      if (raw === 'IP') return 'ip'
      if (raw === '포트') return 'port'
      if (raw === '아이디') return 'id'
      if (raw === '비밀번호') return 'pw'
      return lower
    }

    const proxies: NonNullable<AppSettings['proxies']> = []
    for (const row of rows) {
      const obj: Record<string, any> = {}
      Object.keys(row).forEach(key => {
        const k = canonicalizeKey(key)
        obj[k] = row[key]
      })

      const ip = String(obj['ip'] || '').trim()
      const portRaw = obj['port']
      const id = String(obj['id'] || '').trim() || undefined
      const pw = String(obj['pw'] || '').trim() || undefined

      const port = Number(portRaw)
      if (!ip || Number.isNaN(port) || port <= 0) {
        continue
      }

      proxies.push({ ip, port, id, pw })
    }

    const current = await this.getSettings()
    const combinedProxies = [...(current.proxies ?? []), ...proxies]
    const next: AppSettings = {
      ...current,
      proxies: combinedProxies,
    }
    await this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, data: next as any },
      update: { data: next as any },
    })

    return { success: true, count: proxies.length }
  }

  /**
   * 프록시 샘플 엑셀 생성
   */
  public generateProxySampleExcel(): { buffer: Buffer; filename: string } {
    const headers = ['IP', '포트', '아이디', '비밀번호']
    const sampleRows = [
      { IP: '1.2.3.4', 포트: 8080, 아이디: 'user01', 비밀번호: 'pass01' },
      { IP: '5.6.7.8', 포트: 3128, 아이디: '', 비밀번호: '' },
    ]

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '프록시목록')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const filename = `proxy-sample-${Date.now()}.xlsx`
    return { buffer, filename }
  }
}
