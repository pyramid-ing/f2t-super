import { Injectable, OnModuleInit } from '@nestjs/common'
import { AuthService } from './auth.service'

@Injectable()
export class AuthInitializer implements OnModuleInit {
  constructor(private readonly authService: AuthService) {}

  async onModuleInit() {
    try {
      console.log('Initializing license information...')
      await this.authService.initializeLicenseInfo()
      console.log('License information initialized successfully')
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to initialize license information:', error.message, '\n', error.stack)
      } else {
        console.error('Failed to initialize license information:', error)
      }
    }
  }
}
