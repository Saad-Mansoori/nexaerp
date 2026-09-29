export const PERMISSIONS = [
  'tenant.read',
  'tenant.update',
  'user.invite',
  'user.suspend',
  'role.read',
  'role.create',
  'role.update',
  'role.delete',
  'audit.read',
  'storage.upload',
  'storage.delete',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'tenant.read': 'View tenant details and settings',
  'tenant.update': 'Update tenant settings',
  'user.invite': 'Invite users to the tenant',
  'user.suspend': 'Suspend or activate users in the tenant',
  'role.read': 'View roles and their permissions',
  'role.create': 'Create new roles',
  'role.update': 'Update roles and their permissions',
  'role.delete': 'Delete roles',
  'audit.read': 'View audit logs',
  'storage.upload': 'Upload files to storage',
  'storage.delete': 'Delete files from storage',
} as const;

export function isPermission(code: string): code is Permission {
  return PERMISSIONS.includes(code as Permission);
}

export function assertPermission(code: string): asserts code is Permission {
  if (!isPermission(code)) {
    throw new Error(`Invalid permission code: ${code}`);
  }
}
