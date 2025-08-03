import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobProcessor, JobStatus, JobType } from '@main/app/modules/job/job.types'
import { TopicService } from './topic.service'
import { saveTopicsResultAsXlsx } from './topic-job.util'
import { JobLogsService } from '../job-logs/job-logs.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

@Injectable()
export class TopicJobService implements JobProcessor {
  private readonly logger = new Logger(TopicJobService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly topicService: TopicService,
    private readonly jobLogsService: JobLogsService,
  ) {}

  canProcess(job: any): boolean {
    return job.type === JobType.GENERATE_TOPIC
  }

  async process(jobId: string): Promise<void> {
    const job = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        topicJob: true,
      },
    })

    if (!job.topicJob) {
      throw new CustomHttpException(ErrorCode.TOPIC_JOB_NOT_FOUND, { message: 'Topic job data not found' })
    }

    await this.createJobLog(jobId, 'info', '토픽 생성 작업 시작')

    // 1. 토픽 생성
    await this.createJobLog(jobId, 'info', `토픽 생성 시작: ${job.topicJob.topic}, 개수: ${job.topicJob.limit}`)
    const topics = await this.topicService.generateTopics(job.topicJob.topic, job.topicJob.limit)
    await this.createJobLog(jobId, 'info', `토픽 생성 완료: ${topics.length}개의 토픽이 생성됨`)

    // 2. 결과 저장
    await this.createJobLog(jobId, 'info', '토픽 결과 저장 시작')
    await this.prisma.topicJob.update({
      where: { id: job.topicJob.id },
      data: {
        result: topics as any,
        status: 'completed',
        xlsxFileName: `find-topics-${jobId}.xlsx`,
      },
    })
    await this.createJobLog(jobId, 'info', '토픽 결과 저장 완료')

    // 3. 결과 파일로 저장
    await this.createJobLog(jobId, 'info', 'Excel 파일 생성 시작')
    await saveTopicsResultAsXlsx(jobId, topics)
    await this.createJobLog(jobId, 'info', 'Excel 파일 생성 완료')

    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        resultMsg: `토픽이 성공적으로 생성되었습니다. (${topics.length}개)`,
        status: 'completed',
      },
    })

    await this.createJobLog(jobId, 'info', '토픽 생성 작업 완료')
  }

  private async createJobLog(jobId: string, level: string, message: string) {
    await this.jobLogsService.createJobLog(jobId, message, level as any)
  }

  /**
   * 토픽 생성 작업을 등록합니다.
   * @param topic 주제
   * @param limit 생성 개수
   */
  async createTopicJob(topic: string, limit: number) {
    // subject/desc는 Job 목록에서 보여질 정보
    const subject = `토픽 생성: ${topic}`
    const desc = `주제: ${topic}, 개수: ${limit}`

    const job = await this.prisma.job.create({
      data: {
        subject,
        desc,
        targetType: JobType.GENERATE_TOPIC,
        status: JobStatus.PENDING,
        priority: 1,
        scheduledAt: new Date(),
        topicJob: {
          create: {
            topic,
            limit,
            status: 'draft',
          },
        },
      },
      include: {
        topicJob: true,
      },
    })

    await this.createJobLog(job.id, 'info', `토픽 생성 작업이 등록되었습니다. (주제: ${topic})`)
    return job
  }
}
