import { Body, Controller, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common'
import { TistoryAutomationService } from './tistory-automation.service'
import { PublishTistoryAutomationDto } from './dto/publish-tistory-automation.dto'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

@Controller('tistory-automation')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class TistoryAutomationController {
  constructor(private readonly tistoryAutomationService: TistoryAutomationService) {}

  @Post('publish')
  @Permissions(Permission.PUBLISH_TISTORY)
  async publish(
    @Body() dto: PublishTistoryAutomationDto,
  ): Promise<{ success: boolean; message: string; url?: string }> {
    return this.tistoryAutomationService.publish(dto)
  }
}
