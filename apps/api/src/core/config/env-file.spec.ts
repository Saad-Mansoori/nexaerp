import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyEnvFile, loadEnvFiles } from './env-file.js';

describe('applyEnvFile', () => {
  const KEY = 'NEXAERP_ENV_FILE_SPEC';

  afterEach(() => {
    delete process.env[KEY];
  });

  it('parses assignments and ignores comments and blank lines', () => {
    applyEnvFile(['# comment', '', `${KEY}=parsed-value`, 'MALFORMED LINE'].join('\n'));
    expect(process.env[KEY]).toBe('parsed-value');
  });

  it('strips matching surrounding quotes', () => {
    applyEnvFile(`${KEY}="quoted value"`);
    expect(process.env[KEY]).toBe('quoted value');
    delete process.env[KEY];
    applyEnvFile(`${KEY}='single'`);
    expect(process.env[KEY]).toBe('single');
  });

  it('never overrides an existing environment variable', () => {
    process.env[KEY] = 'already-set';
    applyEnvFile(`${KEY}=from-file`);
    expect(process.env[KEY]).toBe('already-set');
  });

  it('ignores lines without a separator and empty keys', () => {
    applyEnvFile(`=${KEY}nope\nno-separator-here`);
    expect(process.env[KEY]).toBeUndefined();
  });
});

describe('loadEnvFiles', () => {
  const rootKey = 'NEXAERP_ENV_WALK_SPEC';

  afterEach(() => {
    delete process.env[rootKey];
  });

  it('walks candidate paths upward and applies the nearest .env', () => {
    const base = mkdtempSync(join(tmpdir(), 'nexaerp-env-'));
    const nested = join(base, 'packages', 'api');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(base, '.env'), `${rootKey}=from-nearest\n`);

    try {
      const found = loadEnvFiles(nested);
      expect(found).toBe(true);
      expect(process.env[rootKey]).toBe('from-nearest');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('returns false when no candidate file exists', () => {
    const missing = join(tmpdir(), 'nexaerp-env-does-not-exist');
    expect(loadEnvFiles(missing)).toBe(false);
  });
});
