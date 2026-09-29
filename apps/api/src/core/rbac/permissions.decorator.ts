import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS, type Permission } from '@nexaerp/shared';

export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';

export const RequirePermissions = (...permissions: Permission[]) => {
  for (const p of permissions) {
    if (!PERMISSIONS.includes(p)) {
      throw new Error(`Invalid permission: ${p}`);
    }
  }
  return SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
};
