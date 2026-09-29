import { z } from 'zod';
import { Permission, PERMISSIONS } from '../../permissions';

export const roleSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(64),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissions: z.array(z.enum(PERMISSIONS)),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Role = z.infer<typeof roleSchema>;

export const membershipSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  tenantId: z.uuid(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  roles: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Membership = z.infer<typeof membershipSchema>;

export const userWithMembershipsSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  memberships: z.array(membershipSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type UserWithMemberships = z.infer<typeof userWithMembershipsSchema>;

export const createRoleSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  permissions: z.array(z.enum(PERMISSIONS)).min(1),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(500).nullable().optional(),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
  isSystem: z.boolean().optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const assignRoleSchema = z.object({
  roleId: z.uuid(),
});

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

export const membershipResponseSchema = z.object({
  data: membershipSchema,
});

export type MembershipResponse = z.infer<typeof membershipResponseSchema>;

export const membershipsResponseSchema = z.object({
  data: z.array(membershipSchema),
  meta: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
});

export type MembershipsResponse = z.infer<typeof membershipsResponseSchema>;

export const rolesResponseSchema = z.object({
  data: z.array(roleSchema),
});

export type RolesResponse = z.infer<typeof rolesResponseSchema>;

export const roleResponseSchema = z.object({
  data: roleSchema,
});

export type RoleResponse = z.infer<typeof roleResponseSchema>;
