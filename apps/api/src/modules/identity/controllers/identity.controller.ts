import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { IdentityService } from '../services/identity.service.js';
import { RequirePermissions } from '@nexaerp/api/core/rbac/permissions.decorator.js';
import { CurrentUserId } from '@nexaerp/api/core/tenancy/tenant.decorator.js';
import {
  createRoleSchema,
  type CreateRoleInput,
  updateRoleSchema,
  type UpdateRoleInput,
  assignRoleSchema,
  type AssignRoleInput,
} from '@nexaerp/shared';
import { ZodValidationPipe } from '@nexaerp/api/core/errors/zod-validation.pipe.js';

@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get('memberships')
  @RequirePermissions('user.invite')
  async getMemberships(@CurrentUserId() userId: string) {
    return this.identityService.getMemberships(userId);
  }

  @Get('roles')
  @RequirePermissions('role.read')
  async getRoles() {
    return this.identityService.getRoles();
  }

  @Get('roles/:roleId')
  @RequirePermissions('role.read')
  async getRole(@Param('roleId') roleId: string) {
    return this.identityService.getRole(roleId);
  }

  @Post('roles')
  @RequirePermissions('role.create')
  async createRole(@Body(new ZodValidationPipe(createRoleSchema)) input: CreateRoleInput) {
    return this.identityService.createRole(input);
  }

  @Patch('roles/:roleId')
  @RequirePermissions('role.update')
  async updateRole(
    @Param('roleId') roleId: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) input: UpdateRoleInput,
  ) {
    return this.identityService.updateRole(roleId, input);
  }

  @Delete('roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('role.delete')
  async deleteRole(@Param('roleId') roleId: string) {
    return this.identityService.deleteRole(roleId);
  }

  @Get('memberships/:membershipId')
  @RequirePermissions('user.invite')
  async getMembership(@Param('membershipId') membershipId: string) {
    return this.identityService.getMembership(membershipId);
  }

  @Patch('memberships/:membershipId/suspend')
  @RequirePermissions('user.suspend')
  async suspendMembership(@Param('membershipId') membershipId: string) {
    return this.identityService.suspendMembership(membershipId);
  }

  @Patch('memberships/:membershipId/activate')
  @RequirePermissions('user.suspend')
  async activateMembership(@Param('membershipId') membershipId: string) {
    return this.identityService.activateMembership(membershipId);
  }

  @Post('memberships/:membershipId/roles')
  @RequirePermissions('role.update')
  async assignRole(
    @Param('membershipId') membershipId: string,
    @Body(new ZodValidationPipe(assignRoleSchema)) input: AssignRoleInput,
  ) {
    return this.identityService.assignRole(membershipId, input);
  }

  @Delete('memberships/:membershipId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('role.update')
  async removeRole(@Param('membershipId') membershipId: string, @Param('roleId') roleId: string) {
    return this.identityService.removeRole(membershipId, roleId);
  }
}
