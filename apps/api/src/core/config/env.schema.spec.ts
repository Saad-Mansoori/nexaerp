import { envSchema } from './env.schema.js';

const base = { DATABASE_URL: 'postgresql://nexaerp@localhost:5432/nexaerp' };

describe('envSchema', () => {
  it('applies the documented defaults', () => {
    const parsed = envSchema.parse(base);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(4000);
    expect(parsed.WEB_ORIGIN).toBe('http://localhost:3000');
    expect(parsed.LOG_LEVEL).toBe('info');
    expect(parsed.THROTTLE_TTL_MS).toBe(60_000);
    expect(parsed.THROTTLE_LIMIT).toBe(300);
    expect(parsed.AUTO_MIGRATE).toBe('false');
    expect(parsed.SUPABASE_URL).toBeUndefined();
    expect(parsed.SUPABASE_JWT_SECRET).toBeUndefined();
  });

  it('coerces numeric strings', () => {
    const parsed = envSchema.parse({ ...base, PORT: '5000', THROTTLE_LIMIT: '42' });
    expect(parsed.PORT).toBe(5000);
    expect(parsed.THROTTLE_LIMIT).toBe(42);
  });

  it('requires DATABASE_URL', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    const result = envSchema.safeParse({ ...base, LOG_LEVEL: 'chatty' });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range NODE_ENV', () => {
    const result = envSchema.safeParse({ ...base, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('treats blank optional values as absent', () => {
    const parsed = envSchema.parse({ ...base, SUPABASE_URL: '', SUPABASE_JWT_SECRET: '' });
    expect(parsed.SUPABASE_URL).toBeUndefined();
    expect(parsed.SUPABASE_JWT_SECRET).toBeUndefined();
  });

  it('validates optional URLs', () => {
    const ok = envSchema.safeParse({ ...base, SUPABASE_URL: 'https://example.supabase.co' });
    expect(ok.success).toBe(true);
    const bad = envSchema.safeParse({ ...base, SUPABASE_URL: 'not-a-url' });
    expect(bad.success).toBe(false);
  });

  it('strips unknown keys from the parsed result', () => {
    const parsed = envSchema.parse({ ...base, SOMETHING_ELSE: 'ignored' });
    expect('SOMETHING_ELSE' in parsed).toBe(false);
  });
});
