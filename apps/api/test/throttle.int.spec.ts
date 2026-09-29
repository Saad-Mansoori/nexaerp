import type { INestApplication } from '@nestjs/common';
import { problemDetailsSchema } from '@nexaerp/shared';

import { appUrl, createTestApp } from './test-app.js';

describe('rate limiting', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createTestApp({ throttleLimit: 2, throttleTtlMs: 60_000 });
    baseUrl = appUrl(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows requests under the limit and answers the third with 429 + Retry-After', async () => {
    const first = await fetch(`${baseUrl}/api/v1/health/live`);
    const second = await fetch(`${baseUrl}/api/v1/health/live`);
    const blocked = await fetch(`${baseUrl}/api/v1/health/live`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('60');
    expect(blocked.headers.get('content-type')).toContain('application/problem+json');

    const body: unknown = await blocked.json();
    const parsed = problemDetailsSchema.parse(body);
    expect(parsed.code).toBe('RATE_LIMITED');
    expect(parsed.type).toBe('https://nexaerp.dev/problems/rate-limited');
    expect(parsed.status).toBe(429);
  });
});
