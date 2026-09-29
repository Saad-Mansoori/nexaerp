import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppConfigService } from './core/config/app-config.service.js';
import { ConfigModule } from './core/config/config.module.js';
import { AllExceptionsFilter } from './core/errors/all-exceptions.filter.js';
import { HealthModule } from './core/health/health.module.js';
import { PinoLoggerService } from './core/logging/pino-logger.service.js';
import { RequestIdInterceptor } from './core/logging/request-id.interceptor.js';
import { PrismaModule } from './core/prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
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
  ],
})
export class AppModule {}
