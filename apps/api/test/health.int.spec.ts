import type { INestApplication } from '@nestjs/common';
import { healthResponseSchema, problemDetailsSchema } from '@nexaerp/shared';

import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { appUrl, createTestApp } from './test-app.js';

describe('health endpoints', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createTestApp();
    baseUrl = appUrl(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live returns the live envelope', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(healthResponseSchema.parse((await response.json()) as unknown)).toEqual({
      data: { status: 'live' },
    });
  });

  it('GET /api/v1/health/ready returns ready against the real database', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse((await response.json()) as unknown)).toEqual({
      data: { status: 'ready' },
    });
  });

  it('GET /api/v1/health/ready returns 503 problem details when the database is down', async () => {
    const downApp = await createTestApp({}, (builder) =>
      builder.overrideProvider(PrismaService).useValue({
        $queryRaw: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
        $disconnect: jest.fn(),
      }),
    );

    try {
      const response = await fetch(`${appUrl(downApp)}/api/v1/health/ready`);

      expect(response.status).toBe(503);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      const body: unknown = await response.json();
      const parsed = problemDetailsSchema.parse(body);
      expect(parsed.code).toBe('SERVICE_UNAVAILABLE');
      expect(parsed.title).toBe('Service Unavailable');
      expect(parsed.type).toBe('https://nexaerp.dev/problems/service-unavailable');
      expect(JSON.stringify(parsed)).not.toContain('ECONNREFUSED');
    } finally {
      await downApp.close();
    }
  });
});
