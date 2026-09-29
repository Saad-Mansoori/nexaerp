import { buildPinoOptions, REDACTED_PATHS } from './pino.config.js';

describe('buildPinoOptions', () => {
  it('sets the configured level', () => {
    expect(buildPinoOptions('warn').level).toBe('warn');
    expect(buildPinoOptions('silent').level).toBe('silent');
  });

  it('redacts authorization and cookie headers', () => {
    expect(REDACTED_PATHS).toContain('req.headers.authorization');
    expect(REDACTED_PATHS).toContain('req.headers.cookie');
    const options = buildPinoOptions('info');
    const redact = options.redact as { paths: string[]; censor: string };
    expect(redact.paths).toEqual(REDACTED_PATHS);
    expect(redact.censor).toBe('[redacted]');
  });

  it('emits ISO timestamps', () => {
    expect(typeof buildPinoOptions('info').timestamp).toBe('function');
  });
});
