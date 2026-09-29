import { z } from 'zod';

export const tenantSettingsSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  timezone: z.string().default('UTC'),
  dateFormat: z.string().default('YYYY-MM-DD'),
  timeFormat: z.string().default('HH:mm'),
  currency: z.string().length(3).default('USD'),
  locale: z.string().default('en-US'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;

export const tenantProfileSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  settings: tenantSettingsSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type TenantProfile = z.infer<typeof tenantProfileSchema>;

export const updateTenantSettingsSchema = z.object({
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().optional(),
});

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;

export const tenantSettingsResponseSchema = z.object({
  data: tenantSettingsSchema,
});

export type TenantSettingsResponse = z.infer<typeof tenantSettingsResponseSchema>;

export const tenantProfileResponseSchema = z.object({
  data: tenantProfileSchema,
});

export type TenantProfileResponse = z.infer<typeof tenantProfileResponseSchema>;
