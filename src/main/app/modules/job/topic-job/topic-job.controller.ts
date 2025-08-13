import { Controller, Get, Param, Res } from '@nestjs/common'
import { Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { EnvConfig } from '@main/config/env.config'

@Controller('topic-job-job')
export class TopicJobController {
  @Get('download-topic-job-job/:jobId')
  async downloadTopicJobXlsx(@Res() res: Response, @Param('jobId') jobId: string) {
    const filePath = path.join(EnvConfig.exportsDir, `find-topics-${jobId}.xlsx`)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '파일이 존재하지 않습니다.' })
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="find-topics-${jobId}.xlsx"`)
    const stream = fs.createReadStream(filePath)
    stream.pipe(res)
  }
}
