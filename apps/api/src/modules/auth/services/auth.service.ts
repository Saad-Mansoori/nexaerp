import { Injectable } from '@nestjs/common';

import { PrismaService } from '@nexaerp/api/core/prisma/prisma.service.js';
import { getTenantId, getMembershipId } from '@nexaerp/api/core/tenancy/tenant-context.js';
import { PERMISSIONS } from '@nexaerp/shared';
import { authMeResponseSchema, type AuthMeResponse } from '@nexaerp/shared';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<AuthMeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        tenant: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    const activeTenantId = getTenantId();
    const activeMembershipId = getMembershipId();

    const tenants = memberships.map((m) => ({
      id: m.tenant.id,
      slug: m.tenant.slug,
      name: m.tenant.name,
      status: m.tenant.status,
      membershipId: m.id,
      roles: m.roles.map((mr) => mr.role.name),
      permissions: Array.from(
        new Set(m.roles.flatMap((mr) => mr.role.permissions.map((rp) => rp.permission.code))),
      ),
    }));

    const activeTenant = activeTenantId
      ? (tenants.find((t) => t.id === activeTenantId) ?? null)
      : null;

    const permissions = activeMembershipId
      ? Array.from(
          new Set(
            memberships
              .filter((m) => m.id === activeMembershipId)
              .flatMap((m) =>
                m.roles.flatMap((mr) => mr.role.permissions.map((rp) => rp.permission.code)),
              ),
          ),
        )
      : [];

    return authMeResponseSchema.parse({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        tenants,
        activeTenant,
        permissions,
      },
    });
  }
}
