// 파일 존재 여부 확인
import { app } from 'electron'
import electronLog from 'electron-log'

import { EnvConfig } from './env.config'

export class LoggerConfig {
  private static logger = electronLog

  public static initialize() {
    // 로그 파일 경로 설정 및 파일 로깅은 패키지 상태에서만 적용
    if (EnvConfig.isPackaged) {
      this.logger.transports.file.resolvePathFn = () => {
        return EnvConfig.logPath
      }
      // 프로덕션에서는 에러만 로깅
      this.logger.transports.file.level = 'error'
      this.logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text} {stack}'
      this.logger.transports.file.maxSize = 10 * 1024 * 1024
      this.logger.transports.file.archiveLog = oldFile => {
        const timestamp = Date.now()
        return `${oldFile}.${timestamp}`
      }
    } else {
      // 개발환경에서는 파일 로깅 비활성화
      this.logger.transports.file.level = false
    }
    // 콘솔 로깅도 프로덕션에서는 에러만
    this.logger.transports.console.level = EnvConfig.isPackaged ? 'error' : 'info'

    // 전역 에러 핸들링 설정
    this.setupErrorHandlers()
  }

  static logSystemInfo() {
    this.logger.error('--- System Information ---')
    this.logger.error('App Version:', process.env.npm_package_version)
    this.logger.error('Environment:', process.env.NODE_ENV)
    this.logger.error('Platform:', process.platform)
    this.logger.error('Architecture:', process.arch)
    this.logger.error('Electron:', process.versions.electron)
    this.logger.error('Chrome:', process.versions.chrome)
    this.logger.error('Node:', process.versions.node)
    this.logger.error('Is Packaged:', EnvConfig.isPackaged)
    this.logger.error('Resource Path:', EnvConfig.resourcePath)
    this.logger.error('App Path:', app.getAppPath())
    this.logger.error('User Data Path:', app.getPath('userData'))
  }

  static logEnvironmentVariables() {
    this.logger.error('--- Environment Variables ---')
    Object.keys(process.env).forEach(key => {
      this.logger.error(`${key}:`, process.env[key])
    })
  }

  private static setupErrorHandlers() {
    // Node.js의 처리되지 않은 예외 처리
    process.on('uncaughtException', error => {
      this.logger.error('Uncaught Exception:', error)
      this.logger.error('Stack:', error.stack)
      // 심각한 에러 발생 시 상세 정보 로깅
      this.logSystemInfo()
      this.logEnvironmentVariables()
    })

    // Node.js의 처리되지 않은 Promise 거부 처리
    process.on('unhandledRejection', (reason: any) => {
      this.logger.error('Unhandled Promise Rejection:', reason)
      if (reason instanceof Error) {
        this.logger.error('Stack:', reason.stack)
      }
    })

    // 전역 에러 이벤트 리스너
    process.on('error', error => {
      this.logger.error('Process Error:', error)
      this.logger.error('Stack:', error.stack)
    })

    // 프로세스 종료 전 마지막 로그 (에러인 경우만)
    process.on('exit', code => {
      if (code !== 0) {
        this.logger.error('=== Application Exit with Error ===')
        this.logger.error('Exit Code:', code)
        this.logger.error('Abnormal Exit - Last known state:')
        this.logSystemInfo()
      }
    })

    // 프로세스 경고 처리 (에러로 로깅)
    process.on('warning', warning => {
      this.logger.error('Process Warning:', warning)
      this.logger.error('Stack:', warning.stack)
    })

    // Electron 앱 이벤트들은 프로덕션에서는 로깅하지 않음
    if (!EnvConfig.isPackaged) {
      // 개발환경에서만 앱 이벤트 로깅
      app.on('ready', () => {
        this.logger.info('Electron App Ready')
      })

      app.on('browser-window-created', (_, window) => {
        this.logger.info('Browser Window Created:', window.id)
      })
    }
  }

  public static getLogger() {
    return this.logger
  }

  // 편의를 위한 직접 로깅 메서드들
  public static error(...params: any[]) {
    this.logger.error(...params)
  }

  public static warn(...params: any[]) {
    // 프로덕션에서는 warn도 error로 로깅
    if (EnvConfig.isPackaged) {
      this.logger.error('WARNING:', ...params)
    } else {
      this.logger.warn(...params)
    }
  }

  public static info(...params: any[]) {
    // 프로덕션에서는 info 로깅하지 않음
    if (!EnvConfig.isPackaged) {
      this.logger.info(...params)
    }
  }

  public static debug(...params: any[]) {
    // 프로덕션에서는 debug 로깅하지 않음
    if (!EnvConfig.isPackaged) {
      this.logger.debug(...params)
    }
  }

  public static verbose(...params: any[]) {
    // 프로덕션에서는 verbose 로깅하지 않음
    if (!EnvConfig.isPackaged) {
      this.logger.verbose(...params)
    }
  }
}
