import type { INestApplication } from '@nestjs/common';
import { ERROR_CODES, healthResponseSchema, problemDetailsSchema } from '@nexaerp/shared';

import { appUrl, createTestApp } from './test-app.js';

describe('shared zod contracts', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createTestApp();
    baseUrl = appUrl(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('parses a real health response with the shared contract', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);
    const body: unknown = await response.json();

    const parsed = healthResponseSchema.parse(body);
    expect(parsed.data.status).toBe('live');
  });

  it('parses a real error response with the shared problem contract', async () => {
    const response = await fetch(`${baseUrl}/api/v1/missing-contract-check`);
    const body: unknown = await response.json();

    const parsed = problemDetailsSchema.parse(body);
    expect(ERROR_CODES).toContain(parsed.code);
    expect(parsed.status).toBe(response.status);
  });
});
