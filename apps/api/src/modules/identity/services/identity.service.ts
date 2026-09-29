import { Injectable } from '@nestjs/common';

import { IdentityRepository } from '../repositories/identity.repository.js';
import { RoleRepository } from '../repositories/role.repository.js';
import { getTenantId, getMembershipId } from '@nexaerp/api/core/tenancy/tenant-context.js';
import {
  membershipsResponseSchema,
  type MembershipsResponse,
  rolesResponseSchema,
  type RolesResponse,
  roleResponseSchema,
  type RoleResponse,
  membershipResponseSchema,
  type MembershipResponse,
  assignRoleSchema,
  type AssignRoleInput,
  createRoleSchema,
  type CreateRoleInput,
  updateRoleSchema,
  type UpdateRoleInput,
} from '@nexaerp/shared';

@Injectable()
export class IdentityService {
  constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  async getMemberships(userId: string): Promise<MembershipsResponse> {
    const memberships = await this.identityRepository.findMembershipsByUserId(userId);
    return membershipsResponseSchema.parse({
      data: memberships,
      meta: { page: 1, pageSize: memberships.length, total: memberships.length },
    });
  }

  async getRoles(): Promise<RolesResponse> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');
    const roles = await this.roleRepository.findRolesByTenant(tenantId);
    return rolesResponseSchema.parse({ data: roles });
  }

  async getRole(roleId: string): Promise<RoleResponse> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');
    const role = await this.roleRepository.findRoleById(tenantId, roleId);
    if (!role) throw new Error('Role not found');
    return roleResponseSchema.parse({ data: role });
  }

  async createRole(input: CreateRoleInput): Promise<RoleResponse> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');
    const role = await this.roleRepository.createRole(tenantId, input);
    return roleResponseSchema.parse({ data: role });
  }

  async updateRole(roleId: string, input: UpdateRoleInput): Promise<RoleResponse> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');
    const role = await this.roleRepository.updateRole(tenantId, roleId, input);
    return roleResponseSchema.parse({ data: role });
  }

  async deleteRole(roleId: string): Promise<void> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');
    await this.roleRepository.deleteRole(tenantId, roleId);
  }

  async getMembership(membershipId: string): Promise<MembershipResponse> {
    const membership = await this.identityRepository.findMembershipById(membershipId);
    if (!membership) throw new Error('Membership not found');
    return membershipResponseSchema.parse({ data: membership });
  }

  async suspendMembership(membershipId: string): Promise<MembershipResponse> {
    const membership = await this.identityRepository.suspendMembership(membershipId);
    return membershipResponseSchema.parse({ data: membership });
  }

  async activateMembership(membershipId: string): Promise<MembershipResponse> {
    const membership = await this.identityRepository.activateMembership(membershipId);
    return membershipResponseSchema.parse({ data: membership });
  }

  async assignRole(membershipId: string, input: AssignRoleInput): Promise<void> {
    await this.identityRepository.assignRole(membershipId, input.roleId);
  }

  async removeRole(membershipId: string, roleId: string): Promise<void> {
    await this.identityRepository.removeRole(membershipId, roleId);
  }
}
