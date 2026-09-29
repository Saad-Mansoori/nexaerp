import { Injectable } from '@nestjs/common';

import { ProblemDetailsException } from '../errors/problem-details.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async ready(): Promise<'ready'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ProblemDetailsException(503, 'SERVICE_UNAVAILABLE', 'Database is not reachable.');
    }
    return 'ready';
  }
}
