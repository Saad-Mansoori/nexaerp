import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../prisma/prisma.service.js';
import { getTenantContext, runWithTenantContext, type TenantContext } from './tenant-context.js';
import { TENANT_REQUIRED_KEY } from './tenant.decorator.js';

const TENANT_HEADER = 'x-tenant-id';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    const tenantRequired = this.reflector.getAllAndOverride<boolean>(TENANT_REQUIRED_KEY, [
      handler,
      context.getClass(),
    ]);

    const tenantId = request.headers[TENANT_HEADER];

    if (!tenantRequired) {
      return true;
    }

    if (!tenantId) {
      throw new ForbiddenException({
        type: 'https://nexaerp.dev/problems/tenant-required',
        title: 'Tenant Required',
        status: 403,
        code: 'TENANT_REQUIRED',
        instance: request.url,
        detail: 'X-Tenant-Id header is required for this endpoint',
      });
    }

    const user = request.user;
    if (!user || !user.id) {
      throw new ForbiddenException({
        type: 'https://nexaerp.dev/problems/auth-required',
        title: 'Authentication Required',
        status: 401,
        code: 'AUTH_REQUIRED',
        instance: request.url,
        detail: 'User must be authenticated',
      });
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException({
        type: 'https://nexaerp.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
        instance: request.url,
        detail: 'User is not a member of this tenant',
      });
    }

    if (membership.status !== 'ACTIVE') {
      throw new ForbiddenException({
        type: 'https://nexaerp.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
        instance: request.url,
        detail: 'Membership is not active',
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new ForbiddenException({
        type: 'https://nexaerp.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
        instance: request.url,
        detail: 'Tenant is not active',
      });
    }

    const contextData: TenantContext = {
      userId: user.id,
      tenantId,
      membershipId: membership.id,
    };

    runWithTenantContext(contextData, () => {
      request.tenantContext = contextData;
    });

    return true;
  }
}

export {
  getTenantContext,
  getTenantId,
  getUserId,
  getMembershipId,
  runWithTenantContext,
} from './tenant-context.js';
export type { TenantContext } from './tenant-context.js';
