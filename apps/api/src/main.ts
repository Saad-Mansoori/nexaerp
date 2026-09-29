import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { AppConfigService } from './core/config/app-config.service.js';
import { loadEnvFiles } from './core/config/env-file.js';
import { PinoLoggerService } from './core/logging/pino-logger.service.js';

async function bootstrap(): Promise<void> {
  loadEnvFiles();
  try {
    const app = await NestFactory.create(AppModule);
    const config = app.get(AppConfigService);
    configureApp(app, config);
    const logger = app.get(PinoLoggerService);
    app.useLogger(logger);
    await app.listen(config.port, '0.0.0.0');
    logger.log(`NexaERP API listening on port ${config.port} (${config.nodeEnv})`);
  } catch (error) {
    console.error(
      '[nexaerp-api] Failed to start:',
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && error.stack !== undefined) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

void bootstrap();
