import { VersioningType, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';

import { AppConfigService } from './core/config/app-config.service.js';
import { AllExceptionsFilter } from './core/errors/all-exceptions.filter.js';
import { RequestIdInterceptor } from './core/logging/request-id.interceptor.js';

export function configureApp(app: INestApplication, config: AppConfigService): void {
  app.use(helmet());
  app.enableCors({
    origin: config.webOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Request-Id'],
    credentials: false,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalFilters(app.get(AllExceptionsFilter));
  app.useGlobalInterceptors(app.get(RequestIdInterceptor));
}
