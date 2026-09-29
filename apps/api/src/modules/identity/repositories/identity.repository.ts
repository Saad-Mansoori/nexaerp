import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { getTenantId, getMembershipId } from '../../../core/tenancy/tenant-context.js';
import { membershipSchema, type Membership } from '@nexaerp/shared';

@Injectable()
export class IdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMembershipsByUserId(userId: string): Promise<Membership[]> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        tenant: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    return memberships.map((m) =>
      membershipSchema.parse({
        id: m.id,
        userId: m.userId,
        tenantId: m.tenantId,
        status: m.status,
        roles: m.roles.map((mr) => mr.role.name),
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      }),
    );
  }

  async findMembershipById(membershipId: string): Promise<Membership | null> {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { id: membershipId },
      include: {
        tenant: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!membership) return null;

    return membershipSchema.parse({
      id: membership.id,
      userId: membership.userId,
      tenantId: membership.tenantId,
      status: membership.status,
      roles: membership.roles.map((mr) => mr.role.name),
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    });
  }

  async suspendMembership(membershipId: string): Promise<Membership> {
    const membership = await this.prisma.tenantMembership.update({
      where: { id: membershipId },
      data: { status: 'SUSPENDED' },
      include: {
        tenant: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    return membershipSchema.parse({
      id: membership.id,
      userId: membership.userId,
      tenantId: membership.tenantId,
      status: membership.status,
      roles: membership.roles.map((mr) => mr.role.name),
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    });
  }

  async activateMembership(membershipId: string): Promise<Membership> {
    const membership = await this.prisma.tenantMembership.update({
      where: { id: membershipId },
      data: { status: 'ACTIVE' },
      include: {
        tenant: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    return membershipSchema.parse({
      id: membership.id,
      userId: membership.userId,
      tenantId: membership.tenantId,
      status: membership.status,
      roles: membership.roles.map((mr) => mr.role.name),
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    });
  }

  async assignRole(membershipId: string, roleId: string): Promise<void> {
    await this.prisma.membershipRole.create({
      data: { membershipId, roleId },
    });
  }

  async removeRole(membershipId: string, roleId: string): Promise<void> {
    await this.prisma.membershipRole.delete({
      where: { membershipId_roleId: { membershipId, roleId } },
    });
  }
}
