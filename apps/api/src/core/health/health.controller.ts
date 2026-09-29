import { Controller, Get } from '@nestjs/common';

import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live() {
    return { data: { status: 'live' as const } };
  }

  @Get('ready')
  async ready() {
    return { data: { status: await this.health.ready() } };
  }
}
