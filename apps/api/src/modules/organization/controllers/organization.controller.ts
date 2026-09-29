import { Controller, Get, Patch, Body } from '@nestjs/common';

import { OrganizationService } from '../services/organization.service.js';
import { RequirePermissions } from '@nexaerp/api/core/rbac/permissions.decorator.js';
import { updateTenantSettingsSchema, type UpdateTenantSettingsInput } from '@nexaerp/shared';
import { ZodValidationPipe } from '@nexaerp/api/core/errors/zod-validation.pipe.js';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('profile')
  @RequirePermissions('tenant.read')
  async getProfile() {
    return this.organizationService.getProfile();
  }

  @Get('settings')
  @RequirePermissions('tenant.read')
  async getSettings() {
    return this.organizationService.getSettings();
  }

  @Patch('settings')
  @RequirePermissions('tenant.update')
  async updateSettings(
    @Body(new ZodValidationPipe(updateTenantSettingsSchema)) input: UpdateTenantSettingsInput,
  ) {
    return this.organizationService.updateSettings(input);
  }
}
