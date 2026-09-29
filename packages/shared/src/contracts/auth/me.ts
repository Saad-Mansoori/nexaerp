import { z } from 'zod';
import { Permission, PERMISSIONS } from '../../permissions';

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().nullable(),
  avatarUrl: z.url().nullable(),
});

export type User = z.infer<typeof userSchema>;

export const tenantSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
});

export type Tenant = z.infer<typeof tenantSchema>;

export const authMeTenantSchema = tenantSchema.extend({
  membershipId: z.uuid(),
  roles: z.array(z.string()),
  permissions: z.array(z.enum(PERMISSIONS)),
});

export type AuthMeTenant = z.infer<typeof authMeTenantSchema>;

export const authMeResponseSchema = z.object({
  data: z.object({
    user: userSchema,
    tenants: z.array(authMeTenantSchema),
    activeTenant: authMeTenantSchema.nullable(),
    permissions: z.array(z.enum(PERMISSIONS)),
  }),
});

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;
