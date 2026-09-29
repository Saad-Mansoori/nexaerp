import type { INestApplication } from '@nestjs/common';
import { problemDetailsSchema } from '@nexaerp/shared';

import { REQUEST_ID_HEADER } from '../src/core/logging/request-id.interceptor.js';
import { appUrl, createTestApp } from './test-app.js';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('security headers, CORS and request ids', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createTestApp();
    baseUrl = appUrl(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sets helmet security headers on responses', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBeTruthy();
  });

  it('allows preflight requests from the configured WEB_ORIGIN', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('does not allow origins outside the allowlist', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.test',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('generates a request id when none is supplied', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);
    const requestId = response.headers.get(REQUEST_ID_HEADER);

    expect(requestId).toMatch(UUID_V4_PATTERN);
  });

  it('echoes an inbound request id', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
      headers: { [REQUEST_ID_HEADER]: 'integration-trace-7' },
    });

    expect(response.headers.get(REQUEST_ID_HEADER)).toBe('integration-trace-7');
  });

  it('does not serve routes outside the /api/v1 prefix', async () => {
    const response = await fetch(`${baseUrl}/health/live`);

    expect(response.status).toBe(404);
    const body: unknown = await response.json();
    const parsed = problemDetailsSchema.parse(body);
    expect(parsed.code).toBe('NOT_FOUND');
  });
});
