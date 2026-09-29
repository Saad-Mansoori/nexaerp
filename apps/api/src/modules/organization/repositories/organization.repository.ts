import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { getTenantId } from '../../../core/tenancy/tenant-context.js';
import {
  tenantSettingsSchema,
  type TenantSettings,
  updateTenantSettingsSchema,
  type UpdateTenantSettingsInput,
} from '@nexaerp/shared';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTenant(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
  }

  async getSettings(): Promise<TenantSettings> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');

    let settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await this.prisma.tenantSettings.create({
        data: { tenantId },
      });
    }

    return tenantSettingsSchema.parse({
      id: settings.id,
      tenantId: settings.tenantId,
      timezone: settings.timezone,
      dateFormat: settings.dateFormat,
      timeFormat: settings.timeFormat,
      currency: settings.currency,
      locale: settings.locale,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    });
  }

  async updateSettings(input: UpdateTenantSettingsInput): Promise<TenantSettings> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');

    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      update: input,
      create: { tenantId, ...input },
    });

    return tenantSettingsSchema.parse({
      id: settings.id,
      tenantId: settings.tenantId,
      timezone: settings.timezone,
      dateFormat: settings.dateFormat,
      timeFormat: settings.timeFormat,
      currency: settings.currency,
      locale: settings.locale,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    });
  }
}
