import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { Server } from 'node:http';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AppConfigService } from '../src/core/config/app-config.service.js';

export interface TestConfigOverrides {
  throttleTtlMs?: number;
  throttleLimit?: number;
}

export function createTestConfig(overrides: TestConfigOverrides = {}): AppConfigService {
  const base = new AppConfigService();
  return {
    nodeEnv: base.nodeEnv,
    port: base.port,
    webOrigins: base.webOrigins,
    databaseUrl: base.databaseUrl,
    logLevel: 'silent',
    throttleTtlMs: overrides.throttleTtlMs ?? base.throttleTtlMs,
    throttleLimit: overrides.throttleLimit ?? base.throttleLimit,
    autoMigrate: false,
    supabaseUrl: base.supabaseUrl,
    supabaseJwtSecret: base.supabaseJwtSecret,
    supabaseServiceRoleKey: base.supabaseServiceRoleKey,
    supabaseStorageBucket: base.supabaseStorageBucket,
  } as AppConfigService;
}

export async function createTestApp(
  overrides: TestConfigOverrides = {},
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  const config = createTestConfig(overrides);
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfigService)
    .useValue(config);
  if (customize !== undefined) {
    builder = customize(builder);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, config);
  await app.listen(0, '127.0.0.1');
  return app;
}

export function appUrl(app: INestApplication): string {
  const server = app.getHttpServer() as Server;
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test application is not listening on a TCP port.');
  }
  return `http://127.0.0.1:${address.port}`;
}
