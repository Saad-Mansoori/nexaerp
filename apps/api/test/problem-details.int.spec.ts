import type { INestApplication } from '@nestjs/common';
import { problemDetailsSchema } from '@nexaerp/shared';

import { appUrl, createTestApp } from './test-app.js';

describe('problem+json error responses', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createTestApp();
    baseUrl = appUrl(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('unknown routes return 404 problem+json with a stable code and no stack trace', async () => {
    const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    const raw = await response.text();
    const body = problemDetailsSchema.parse(JSON.parse(raw));
    expect(body.code).toBe('NOT_FOUND');
    expect(body.title).toBe('Not Found');
    expect(body.type).toBe('https://nexaerp.dev/problems/not-found');
    expect(body.instance).toBe('/api/v1/does-not-exist');
    expect(raw).not.toContain('node_modules');
    expect(raw).not.toContain('    at ');
  });

  it('requests with a method that does not exist on a route return a problem response', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, { method: 'POST' });

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    const body: unknown = await response.json();
    const parsed = problemDetailsSchema.parse(body);
    expect(parsed.code).toBe('NOT_FOUND');
  });
});
