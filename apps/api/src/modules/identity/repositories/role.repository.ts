import { Injectable } from '@nestjs/common';

import { PrismaService } from '@nexaerp/api/core/prisma/prisma.service.js';
import { getTenantId } from '@nexaerp/api/core/tenancy/tenant-context.js';
import {
  roleSchema,
  type Role,
  createRoleSchema,
  type CreateRoleInput,
  updateRoleSchema,
  type UpdateRoleInput,
} from '@nexaerp/shared';

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRolesByTenant(tenantId: string): Promise<Role[]> {
    const roles = await this.prisma.role.findMany({
      where: { tenantId, deletedAt: null },
      include: { permissions: { include: { permission: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return roles.map((r) =>
      roleSchema.parse({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: r.permissions.map((rp) => rp.permission.code),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }),
    );
  }

  async findRoleById(tenantId: string, roleId: string): Promise<Role | null> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId, deletedAt: null },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role) return null;

    return roleSchema.parse({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => rp.permission.code),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    });
  }

  async createRole(tenantId: string, input: CreateRoleInput): Promise<Role> {
    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description,
        permissions: {
          create: input.permissions.map((code) => ({ permission: { connect: { code } } })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    return roleSchema.parse({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => rp.permission.code),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    });
  }

  async updateRole(tenantId: string, roleId: string, input: UpdateRoleInput): Promise<Role> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId, deletedAt: null },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    if (role.isSystem && (input.name || input.isSystem !== undefined)) {
      throw new Error('Cannot modify system role name or system flag');
    }

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: input.name ?? role.name,
        description: input.description ?? role.description,
        isSystem: input.isSystem ?? role.isSystem,
        permissions: input.permissions
          ? {
              deleteMany: {},
              create: input.permissions.map((code) => ({
                permission: { connect: { code } },
              })),
            }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });

    return roleSchema.parse({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isSystem: updated.isSystem,
      permissions: updated.permissions.map((rp) => rp.permission.code),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId, deletedAt: null },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system role');
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: { deletedAt: new Date() },
    });
  }
}
