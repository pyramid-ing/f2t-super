import type { ValidationError } from '@nestjs/common'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import * as bodyParser from 'body-parser'
import { app, ipcMain, shell, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { readFileSync } from 'fs'
import { WinstonModule } from 'nest-winston'
import { utilities as nestWinstonModuleUtilities } from 'nest-winston/dist/winston.utilities'
import { join } from 'path'
import winston from 'winston'
import { AppModule } from './app/app.module'
import { EnvConfig } from './config/env.config'
import { LoggerConfig } from './config/logger.config'
import { environment } from './environments/environment'

EnvConfig.initialize()
LoggerConfig.info(process.env.NODE_ENV)
LoggerConfig.info(process.env.PRISMA_QUERY_ENGINE_BINARY)
LoggerConfig.info(process.env.PRISMA_QUERY_ENGINE_LIBRARY)
LoggerConfig.info(process.env.PUPPETEER_EXECUTABLE_PATH)
LoggerConfig.info(process.env.COOKIE_DIR)

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// AutoUpdater 설정
function setupAutoUpdater() {
  // 개발 환경에서는 업데이트 비활성화
  if (!app.isPackaged) {
    console.log('개발 환경에서는 자동 업데이트가 비활성화됩니다.')
    return
  }

  // 업데이트 로그 설정
  autoUpdater.logger = {
    info: message => console.log('[AutoUpdater]', message),
    warn: message => console.warn('[AutoUpdater]', message),
    error: message => console.error('[AutoUpdater]', message),
    debug: message => console.debug('[AutoUpdater]', message),
  }

  // 업데이트 이벤트 핸들러
  autoUpdater.on('checking-for-update', () => {
    console.log('업데이트를 확인 중입니다...')
  })

  autoUpdater.on('update-available', info => {
    console.log('업데이트가 사용 가능합니다:', info.version)
  })

  autoUpdater.on('update-not-available', info => {
    console.log('현재 최신 버전입니다:', info.version)
  })

  autoUpdater.on('error', err => {
    console.error('업데이트 오류:', err.message)
  })

  autoUpdater.on('download-progress', progressObj => {
    const logMessage = `다운로드 진행률: ${progressObj.percent.toFixed(1)}% (${progressObj.transferred}/${progressObj.total})`
    console.log(logMessage)

    // 모든 창에 진행률 전송
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
      })
    })
  })

  autoUpdater.on('update-downloaded', info => {
    console.log('업데이트 다운로드 완료:', info.version)

    // 모든 창에 업데이트 완료 알림
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('update-downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes,
      })
    })
  })

  // 앱 시작 후 5초 뒤에 업데이트 확인
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 5000)

  // 1시간마다 업데이트 확인
  setInterval(
    () => {
      autoUpdater.checkForUpdatesAndNotify()
    },
    60 * 60 * 1000,
  ) // 1시간
}

// IPC 핸들러 설정
function setupIpcHandlers() {
  ipcMain.handle('get-backend-port', () => null)
  ipcMain.handle('open-external', async (_, url) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('get-app-version', () => {
    try {
      // package.json 직접 읽기
      const appPath = app.isPackaged ? app.getAppPath() : process.cwd()
      const packageJsonPath = join(appPath, 'package.json')

      const packageJsonContent = readFileSync(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(packageJsonContent)

      return packageJson.version
    } catch (error) {
      console.error('Error reading package.json:', error)
      // fallback으로 app.getVersion() 사용
      return app.getVersion()
    }
  })

  // 업데이트 관련 IPC 핸들러
  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      return { message: '개발 환경에서는 업데이트를 확인할 수 없습니다.' }
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      return {
        updateInfo: result?.updateInfo,
        message: '업데이트 확인 완료',
      }
    } catch (error) {
      return {
        error: error.message,
        message: '업데이트 확인 중 오류가 발생했습니다.',
      }
    }
  })

  ipcMain.handle('download-update', async () => {
    if (!app.isPackaged) {
      return { message: '개발 환경에서는 업데이트를 다운로드할 수 없습니다.' }
    }

    try {
      await autoUpdater.downloadUpdate()
      return { message: '업데이트 다운로드를 시작했습니다.' }
    } catch (error) {
      return {
        error: error.message,
        message: '업데이트 다운로드 중 오류가 발생했습니다.',
      }
    }
  })

  ipcMain.handle('install-update', () => {
    if (!app.isPackaged) {
      return { message: '개발 환경에서는 업데이트를 설치할 수 없습니다.' }
    }

    autoUpdater.quitAndInstall()
    return { message: '업데이트를 설치하고 앱을 재시작합니다.' }
  })

  // React-Konva 썸네일 생성 IPC 핸들러
  ipcMain.handle('generate-konva-thumbnail', async (_, data) => {
    try {
      LoggerConfig.info('React-Konva 썸네일 생성 요청 받음:', data)

      // 렌더 프로세스로부터 썸네일 생성 요청을 받아서 처리
      // 실제 처리는 ThumbnailGeneratorService에서 담당
      return {
        success: true,
        message: 'React-Konva 썸네일 생성 요청 처리 완료',
        data,
      }
    } catch (error) {
      LoggerConfig.error('React-Konva 썸네일 생성 중 오류:', error)
      return {
        success: false,
        error: error.message,
        message: 'React-Konva 썸네일 생성 실패',
      }
    }
  })

  // 렌더 프로세스에서 생성된 썸네일 데이터를 받는 핸들러
  ipcMain.handle('save-generated-thumbnail', async (_, { dataUrl, fileName }) => {
    try {
      LoggerConfig.info('생성된 썸네일 저장 요청:', fileName)

      // base64 데이터를 Buffer로 변환
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')

      // 파일 저장 로직은 ThumbnailGeneratorService에서 처리
      return {
        success: true,
        buffer,
        fileName,
        message: '썸네일 데이터 변환 완료',
      }
    } catch (error) {
      LoggerConfig.error('썸네일 저장 중 오류:', error)
      return {
        success: false,
        error: error.message,
        message: '썸네일 저장 실패',
      }
    }
  })
}

async function electronAppInit() {
  const isDev = !app.isPackaged
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  if (isDev) {
    if (process.platform === 'win32') {
      process.on('message', data => {
        if (data === 'graceful-exit') app.quit()
      })
    } else {
      process.on('SIGTERM', () => {
        app.quit()
      })
    }
  }

  await app.whenReady()
  setupIpcHandlers()
  setupAutoUpdater()
}

async function bootstrap() {
  try {
    await electronAppInit()

    const instance = winston.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('ITB', {
              colors: true,
              prettyPrint: true,
            }),
          ),
          level: environment.production ? 'info' : 'silly',
        }),
      ],
    })

    const app = await NestFactory.create(AppModule, {
      logger: WinstonModule.createLogger({
        instance,
      }),
    })

    app.enableCors()
    // app.enableVersioning({
    //   defaultVersion: '1',
    //   type: VersioningType.URI,
    // })
    // app.setGlobalPrefix('api', { exclude: ['sitemap.xml'] })
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        exceptionFactory: (validationErrors: ValidationError[] = []) => {
          console.error(JSON.stringify(validationErrors))
          return new BadRequestException(validationErrors)
        },
      }),
    )

    // Support 10mb csv/json files for importing activities
    app.use(bodyParser.json({ limit: '10mb' }))

    await app.listen(3554)

    console.log('NestJS HTTP server is running on port 3554')
  } catch (error) {
    console.log(error)
    app.quit()
  }
}

bootstrap()
