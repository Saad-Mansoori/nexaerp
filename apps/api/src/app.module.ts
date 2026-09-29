import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppConfigService } from './core/config/app-config.service.js';
import { ConfigModule } from './core/config/config.module.js';
import { AllExceptionsFilter } from './core/errors/all-exceptions.filter.js';
import { HealthModule } from './core/health/health.module.js';
import { PinoLoggerService } from './core/logging/pino-logger.service.js';
import { RequestIdInterceptor } from './core/logging/request-id.interceptor.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { AuthModule } from './core/auth/auth.module.js';
import { TenancyModule } from './core/tenancy/tenancy.module.js';
import { RbacModule } from './core/rbac/rbac.module.js';
import { AuditModule } from './core/audit/audit.module.js';
import { AuthModule as AuthFeatureModule } from './modules/auth/auth.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { OrganizationModule } from './modules/organization/organization.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { AuthGuard } from './core/auth/auth.guard.js';
import { TenantGuard } from './core/tenancy/tenant.guard.js';
import { PermissionsGuard } from './core/rbac/permissions.guard.js';
import { AuditInterceptor } from './core/audit/audit.interceptor.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    TenancyModule,
    RbacModule,
    AuditModule,
    AuthFeatureModule,
    IdentityModule,
    OrganizationModule,
    StorageModule,
    HealthModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [{ ttl: config.throttleTtlMs, limit: config.throttleLimit }],
      }),
    }),
  ],
  providers: [
    AllExceptionsFilter,
    RequestIdInterceptor,
    PinoLoggerService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
