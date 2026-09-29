import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { z, ZodError } from 'zod';

import type { AppConfigService } from '../config/app-config.service.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { ProblemDetailsException } from './problem-details.exception.js';

interface MockResponse {
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
}

function createHost() {
  const response: MockResponse = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  const request = { url: '/api/v1/employees?page=1' };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

const config = { throttleTtlMs: 60_000 } as AppConfigService;

function getJsonBody(response: MockResponse): unknown {
  const calls = response.json.mock.calls as unknown[][];
  return calls[0]?.[0] ?? {};
}

describe('AllExceptionsFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders ProblemDetailsException as problem+json', () => {
    const { host, response } = createHost();
    const filter = new AllExceptionsFilter(config);

    filter.catch(
      new ProblemDetailsException(503, 'SERVICE_UNAVAILABLE', 'Database is not reachable.'),
      host,
    );

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      type: 'https://nexaerp.dev/problems/service-unavailable',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Database is not reachable.',
      code: 'SERVICE_UNAVAILABLE',
      instance: '/api/v1/employees?page=1',
    });
    expect(response.setHeader).not.toHaveBeenCalledWith('Retry-After', expect.anything());
  });

  it('maps Nest HttpExceptions to stable codes', () => {
    const { host, response } = createHost();
    const filter = new AllExceptionsFilter(config);

    filter.catch(new NotFoundException('Route not found'), host);

    const body = getJsonBody(response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(body).toMatchObject({
      type: 'https://nexaerp.dev/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Route not found',
      code: 'NOT_FOUND',
    });
  });

  it('maps ZodError to 422 with field paths', () => {
    const { host, response } = createHost();
    const filter = new AllExceptionsFilter(config);
    const result = z.object({ email: z.string().min(10) }).safeParse({ email: 'short' });
    expect(result.success).toBe(false);

    filter.catch((result as { error: ZodError }).error, host);

    const body = getJsonBody(response);
    expect(response.status).toHaveBeenCalledWith(422);
    expect(body).toMatchObject({
      code: 'VALIDATION_FAILED',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      errors: [{ path: 'email', message: expect.any(String) }],
    });
  });

  it('maps unknown errors to a generic 500 without leaking internals', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error');
    const errorSpyMock = errorSpy as unknown as jest.Mock;
    const { host, response } = createHost();
    const filter = new AllExceptionsFilter(config);

    filter.catch(new TypeError('connection to postgres://user:hunter2@db failed'), host);

    const body = getJsonBody(response);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(body).toMatchObject({
      status: 500,
      detail: 'Internal server error.',
      code: 'INTERNAL',
      title: 'Internal Server Error',
    });
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(errorSpyMock).toHaveBeenCalled();
  });

  it('sets Retry-After for rate-limited responses', () => {
    const { host, response } = createHost();
    const filter = new AllExceptionsFilter(config);

    filter.catch({ status: 429, message: 'ThrottlerException: Too Many Requests' }, host);

    const body = getJsonBody(response) as Record<string, unknown>;
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.type).toBe('https://nexaerp.dev/problems/rate-limited');
  });

  it('maps framework status-style errors such as payload too large', () => {
    const { host, response } = createHost();
    const filter = new AllExceptionsFilter(config);

    filter.catch({ statusCode: 413, type: 'entity.too.large' }, host);

    expect(response.status).toHaveBeenCalledWith(413);
    expect(getJsonBody(response)).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
