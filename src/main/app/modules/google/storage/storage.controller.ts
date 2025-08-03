import { Body, Controller, Post } from '@nestjs/common'
import { StorageService } from './storage.service'

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('create-bucket')
  async createBucket(@Body('bucketName') bucketName: string) {
    await this.storageService.createAndSetBucket(bucketName)
    return {
      status: 'success',
      message: '버킷이 정상적으로 생성 및 설정되었습니다.',
      bucketName,
    }
  }
}
