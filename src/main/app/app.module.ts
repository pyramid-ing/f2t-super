import { join } from 'node:path'
import { ElectronModule } from '@doubleshot/nest-electron'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { app, BrowserWindow } from 'electron'
import { GlobalExceptionFilter } from '../filters/global-exception.filter'
import customConfig from './config/custom-config'
import { SettingsModule } from './modules/settings/settings.module'
import { TopicModule } from './modules/topic/topic.module'
import { WorkflowModule } from './modules/workflow/workflow.module'
import { GoogleModule } from '@main/app/modules/google/google.module'
import { JobModule } from './modules/job/job.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { ContentGenerateModule } from '@main/app/modules/content-generate/content-generate.module'
import { AIModule } from '@main/app/modules/ai/ai.module'
import { CoupangPartnersModule } from './modules/coupang-partners/coupang-partners.module'
import { CoupangCrawlerModule } from './modules/coupang-crawler/coupang-crawler.module'
import { WordPressModule } from './modules/wordpress/wordpress.module'
import { TistoryModule } from './modules/tistory/tistory.module'

@Module({
  imports: [
    ElectronModule.registerAsync({
      useFactory: async () => {
        const isDev = !app.isPackaged
        const win = new BrowserWindow({
          width: 1024,
          height: 768,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            preload: join(__dirname, '../preload/index.cjs'),
          },
        })

        win.on('closed', () => {
          win.destroy()
        })

        const URL = isDev ? process.env.DS_RENDERER_URL : `file://${join(app.getAppPath(), 'dist/render/index.html')}`

        win.loadURL(URL)

        return { win }
      },
    }),
    ConfigModule.forRoot({
      load: [customConfig],
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AIModule,
    SettingsModule,
    GoogleModule,
    TopicModule,
    WorkflowModule,
    CommonModule,
    JobModule,
    ContentGenerateModule,
    CoupangPartnersModule,
    CoupangCrawlerModule,
    WordPressModule,
    TistoryModule,
  ],
  providers: [
    {
      // 의존성 주입이 가능하도록 module에도 설정해준다.
      provide: APP_FILTER,
      useFactory: () => {
        return new GlobalExceptionFilter()
      },
      inject: [],
    },
  ],
  controllers: [],
})
export class AppModule {}
