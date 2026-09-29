import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';

import { PrismaService } from '../prisma/prisma.service.js';
import { getTenantId, getUserId } from '../tenancy/tenant-context.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(options: {
    action: string;
    entity: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const tenantId = getTenantId();
    const actorUserId = getUserId();

    if (!tenantId) {
      return;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: options.action,
          entity: options.entity,
          entityId: options.entityId,
          metadata: options.metadata as Prisma.InputJsonValue,
          ip: options.ip,
          userAgent: options.userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }
}
