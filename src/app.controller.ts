import { Controller, Get, HttpStatus, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Global health check endpoint
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    try {
      // Test database connection
      const isDbHealthy = await this.prisma.isHealthy();
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: isDbHealthy ? 'connected' : 'disconnected',
        service: 'ledger-task',
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        service: 'ledger-task',
        version: '1.0.0',
        error: error.message
      };
    }
  }
}
