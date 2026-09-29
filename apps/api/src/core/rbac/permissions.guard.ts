import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../prisma/prisma.service.js';
import { getTenantId, getMembershipId } from '../tenancy/tenant-context.js';
import { REQUIRE_PERMISSIONS_KEY } from './permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [handler, context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const tenantId = getTenantId();
    const membershipId = getMembershipId();

    if (!tenantId || !membershipId) {
      throw new ForbiddenException({
        type: 'https://nexaerp.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
        instance: request.url,
        detail: 'Tenant context not available',
      });
    }

    const membershipRoles = await this.prisma.membershipRole.findMany({
      where: { membershipId },
      select: { roleId: true },
    });

    if (membershipRoles.length === 0) {
      throw new ForbiddenException({
        type: 'https://nexaerp.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
        instance: request.url,
        detail: 'User has no roles in this tenant',
      });
    }

    const roleIds = membershipRoles.map((mr) => mr.roleId);

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: { permissionId: true },
    });

    const permissionIds = new Set(rolePermissions.map((rp) => rp.permissionId));

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: Array.from(permissionIds) } },
      select: { code: true },
    });

    const userPermissions = new Set(permissions.map((p) => p.code));

    for (const required of requiredPermissions) {
      if (!userPermissions.has(required)) {
        throw new ForbiddenException({
          type: 'https://nexaerp.dev/problems/forbidden',
          title: 'Forbidden',
          status: 403,
          code: 'FORBIDDEN',
          instance: request.url,
          detail: `Missing required permission: ${required}`,
        });
      }
    }

    request.permissions = Array.from(userPermissions);
    return true;
  }
}
