import type { AppConfigService } from '../config/app-config.service.js';
import { PinoLoggerService } from './pino-logger.service.js';

describe('PinoLoggerService', () => {
  const config = { logLevel: 'silent' } as AppConfigService;

  it('accepts the full LoggerService surface without throwing', () => {
    const logger = new PinoLoggerService(config);

    expect(() => {
      logger.log('started', 'Bootstrap');
      logger.warn('careful', 'Test');
      logger.debug('details', 'Test');
      logger.verbose('verbose', 'Test');
      logger.fatal('fatal', 'Test');
      logger.error('boom', 'Error: boom\\n    at test', 'Test');
    }).not.toThrow();
  });
});
