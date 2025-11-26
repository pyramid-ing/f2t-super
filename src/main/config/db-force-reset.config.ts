import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { compareVersions } from 'compare-versions'
import dayjs from 'dayjs'
import { LoggerConfig } from './logger.config'

interface IDbForceResetConfig {
  version: string
  forceReset: boolean
  lastResetVersion?: string
}

export class DbForceResetConfig {
  private static readonly CONFIG_FILE_NAME = 'db-force-reset.json'
  private static userConfigPath: string
  private static resourceConfigPath: string

  public static initialize() {
    // userData 설정 파일 경로 (사용자별 설정)
    this.userConfigPath = path.join(app.isPackaged ? app.getPath('userData') : process.cwd(), this.CONFIG_FILE_NAME)

    // resources 설정 파일 경로 (기본 설정)
    this.resourceConfigPath = app.isPackaged
      ? path.join(process.resourcesPath, this.CONFIG_FILE_NAME)
      : path.join(process.cwd(), this.CONFIG_FILE_NAME)
  }

  /**
   * 강제 초기화가 필요한지 확인합니다
   */
  public static shouldForceReset(): boolean {
    const config = this._readConfig()
    const currentVersion = this.getCurrentVersion()
    const resourceConfig = this._readResourceConfig()

    // resources 설정이 없으면 초기화하지 않음
    if (!resourceConfig) {
      LoggerConfig.info(`Resources 설정 파일 없음: 초기화하지 않음`)
      return false
    }

    // 이전 앱 버전(저장된 config.version)이 resources 설정의 version보다 낮고, forceReset이 true이며
    // 아직 해당 version에서 초기화를 한 적이 없는 경우에만 초기화
    const previousVersion = config.version || '0.0.0'
    const previousVersionCompare = compareVersions(previousVersion, resourceConfig.version)
    const lastResetVersionCompare = config.lastResetVersion
      ? compareVersions(config.lastResetVersion, resourceConfig.version)
      : -1

    if (resourceConfig.forceReset && previousVersionCompare < 0 && lastResetVersionCompare < 0) {
      LoggerConfig.info(
        `DB 강제 초기화 필요: 이전 앱 버전 ${previousVersion} -> 최소 초기화 버전 ${resourceConfig.version} (현재 앱 버전: ${currentVersion}, 마지막 초기화 버전: ${config.lastResetVersion || '없음'})`,
      )
      return true
    }

    return false
  }

  /**
   * DB 강제 초기화 로직을 실행합니다
   * - shouldForceReset() 결과와 초기 DB 존재 여부를 기준으로 DB를 초기화합니다.
   */
  public static initializeDatabase(dbPath: string, userDataPath: string, initialDbPath: string): void {
    // 강제 초기화가 필요한지 확인
    const shouldForceReset = DbForceResetConfig.shouldForceReset()

    // 강제 초기화가 필요하거나 DB가 존재하지 않고 초기 DB가 있는 경우
    if (shouldForceReset || (!fs.existsSync(dbPath) && fs.existsSync(initialDbPath))) {
      // userData 디렉토리가 없으면 생성
      const dbDir = path.dirname(dbPath)
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }

      // 기존 DB 파일이 있으면 백업 후 삭제 (강제 초기화인 경우)
      if (shouldForceReset && fs.existsSync(dbPath)) {
        DbForceResetConfig.backupDatabase(dbPath, userDataPath)
        fs.unlinkSync(dbPath)
        LoggerConfig.info(`기존 데이터베이스 삭제 완료: ${dbPath}`)
      }

      // 초기 DB를 userData로 복사
      fs.copyFileSync(initialDbPath, dbPath)
      LoggerConfig.info(`데이터베이스 초기화 완료: ${dbPath}`)

      // 강제 초기화가 완료되었으면 기록
      if (shouldForceReset) {
        DbForceResetConfig.markResetComplete()
      }
    }
  }

  /**
   * 강제 초기화 완료를 기록합니다
   */
  public static markResetComplete(): void {
    const config = this._readConfig()
    const resourceConfig = this._readResourceConfig()

    // resources 설정의 version을 lastResetVersion으로 저장 (resources 설정이 있는 경우)
    if (resourceConfig) {
      config.lastResetVersion = resourceConfig.version
      config.version = resourceConfig.version
    } else {
      // resources 설정이 없으면 현재 앱 버전 사용
      const currentVersion = this.getCurrentVersion()
      config.lastResetVersion = currentVersion
      config.version = currentVersion
    }

    config.forceReset = false // 강제 초기화 비활성화

    this._saveConfig(config)
    LoggerConfig.info(
      `DB 강제 초기화 완료 기록: 버전 ${config.lastResetVersion} (resources 설정: ${resourceConfig?.version || '없음'})`,
    )
  }

  /**
   * 기존 데이터베이스를 백업합니다
   */
  public static backupDatabase(dbPath: string, userDataPath: string): void {
    try {
      // 백업 디렉토리 경로
      const backupDir = path.join(userDataPath, 'backups')

      // 백업 디렉토리가 없으면 생성
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
        LoggerConfig.info(`백업 디렉토리 생성 완료: ${backupDir}`)
      }

      // 타임스탬프를 포함한 백업 파일명 생성 (YYYYMMDD_HHmmss 형식)
      const timestamp = dayjs().format('YYYYMMDD_HHmmss')
      const backupFileName = `app_${timestamp}.sqlite`
      const backupPath = path.join(backupDir, backupFileName)

      // DB 파일을 백업 디렉토리로 복사
      fs.copyFileSync(dbPath, backupPath)
      LoggerConfig.info(`데이터베이스 백업 완료: ${backupPath}`)
    } catch (error) {
      LoggerConfig.error(`데이터베이스 백업 중 오류:`, error)
      // 백업 실패해도 초기화는 진행
    }
  }
  /**
   * 현재 앱 버전을 가져옵니다
   */
  private static getCurrentVersion(): string {
    try {
      const appPath = app.isPackaged ? app.getAppPath() : process.cwd()
      const packageJsonPath = path.join(appPath, 'package.json')
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(packageJsonContent)
      return packageJson.version
    } catch (error) {
      LoggerConfig.error('버전 정보를 읽을 수 없습니다:', error)
      return '0.0.0'
    }
  }

  /**
   * 설정 파일을 읽고 비교하여 업데이트합니다
   */
  private static _readConfig(): IDbForceResetConfig {
    const currentVersion = this.getCurrentVersion()

    try {
      // 1. userData 설정 파일 읽기
      if (fs.existsSync(this.userConfigPath)) {
        try {
          const userConfigContent = fs.readFileSync(this.userConfigPath, 'utf8')
          const userDataConfig = JSON.parse(userConfigContent) as IDbForceResetConfig

          LoggerConfig.info(`UserData 설정 파일 읽기: ${this.userConfigPath}`)

          // version 필드가 없으면 현재 앱 버전으로 채움 (초기 마이그레이션 대비)
          if (!userDataConfig.version) {
            userDataConfig.version = currentVersion
          }

          return userDataConfig
        } catch (error) {
          LoggerConfig.error('UserData 설정 파일 읽기 오류:', error)
        }
      }
    } catch (error) {
      LoggerConfig.error('설정 파일 처리 오류:', error)
    }

    // 기본 설정 반환
    return {
      version: currentVersion,
      forceReset: false,
    }
  }

  /**
   * resources 설정 파일을 직접 읽습니다
   */
  private static _readResourceConfig(): IDbForceResetConfig | null {
    if (!fs.existsSync(this.resourceConfigPath)) {
      return null
    }

    const configContent = fs.readFileSync(this.resourceConfigPath, 'utf8')
    const resourceConfig = JSON.parse(configContent)
    LoggerConfig.info(`Resources 설정 파일 읽기: ${this.resourceConfigPath}`)
    return resourceConfig
  }

  /**
   * 설정 파일을 저장합니다 (userData에만 저장)
   */
  private static _saveConfig(config: IDbForceResetConfig): void {
    try {
      const configDir = path.dirname(this.userConfigPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      fs.writeFileSync(this.userConfigPath, JSON.stringify(config, null, 2))
      LoggerConfig.info(`설정 파일 저장: ${this.userConfigPath}`)
    } catch (error) {
      LoggerConfig.error('설정 파일 저장 오류:', error)
    }
  }
}
