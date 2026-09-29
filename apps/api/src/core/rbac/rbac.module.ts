import { Global, Module } from '@nestjs/common';

import { PermissionsGuard } from './permissions.guard.js';
import { PermissionCatalogService } from './permission-catalog.service.js';

@Global()
@Module({
  providers: [PermissionsGuard, PermissionCatalogService],
  exports: [PermissionsGuard, PermissionCatalogService],
})
export class RbacModule {}
