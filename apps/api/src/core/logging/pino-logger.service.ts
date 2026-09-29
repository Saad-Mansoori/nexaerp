import { Injectable, type LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';

import { AppConfigService } from '../config/app-config.service.js';
import { buildPinoOptions } from './pino.config.js';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor(config: AppConfigService) {
    this.logger = pino(buildPinoOptions(config.logLevel));
  }

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message));
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.logger.error({ context, trace: stack }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal({ context }, String(message));
  }
}
