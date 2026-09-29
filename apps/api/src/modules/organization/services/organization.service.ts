import { Injectable } from '@nestjs/common';

import { OrganizationRepository } from '../repositories/organization.repository.js';
import { getTenantId } from '@nexaerp/api/core/tenancy/tenant-context.js';
import {
  tenantSettingsResponseSchema,
  type TenantSettingsResponse,
  tenantProfileResponseSchema,
  type TenantProfileResponse,
  updateTenantSettingsSchema,
  type UpdateTenantSettingsInput,
} from '@nexaerp/shared';

@Injectable()
export class OrganizationService {
  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async getProfile(): Promise<TenantProfileResponse> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');

    const tenant = await this.organizationRepository.getTenant(tenantId);
    const settings = await this.organizationRepository.getSettings();

    return tenantProfileResponseSchema.parse({
      data: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        settings,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
      },
    });
  }

  async getSettings(): Promise<TenantSettingsResponse> {
    const settings = await this.organizationRepository.getSettings();
    return tenantSettingsResponseSchema.parse({ data: settings });
  }

  async updateSettings(input: UpdateTenantSettingsInput): Promise<TenantSettingsResponse> {
    const settings = await this.organizationRepository.updateSettings(input);
    return tenantSettingsResponseSchema.parse({ data: settings });
  }
}
