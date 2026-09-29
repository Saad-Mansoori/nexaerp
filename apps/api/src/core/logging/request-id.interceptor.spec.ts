import { ExecutionContext, Logger, NotFoundException } from '@nestjs/common';
import type { CallHandler } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';

import { REQUEST_ID_HEADER, RequestIdInterceptor } from './request-id.interceptor.js';

function createHttpContext(inboundRequestId?: string) {
  const response = {
    setHeader: jest.fn(),
    statusCode: 200,
  };
  const request = {
    method: 'GET',
    url: '/api/v1/health/live',
    header: jest.fn((name: string) => (name === REQUEST_ID_HEADER ? inboundRequestId : undefined)),
  };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { context, response, request };
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('RequestIdInterceptor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a request id, echoes it on the response and logs completion', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const { context, response } = createHttpContext();
    const next: CallHandler = { handle: jest.fn(() => of({ data: { status: 'live' } })) };

    const result = await firstValueFrom(new RequestIdInterceptor().intercept(context, next));

    expect(result).toEqual({ data: { status: 'live' } });
    expect(response.setHeader).toHaveBeenCalledTimes(1);
    const calls = response.setHeader.mock.calls as [string, string][];
    const firstCall = calls[0];
    if (!firstCall) {
      throw new Error('Expected setHeader to have been called');
    }
    const [header, value] = firstCall;
    expect(header).toBe(REQUEST_ID_HEADER);
    expect(String(value)).toMatch(UUID_V4_PATTERN);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`GET /api/v1/health/live 200`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`requestId=${String(value)}`));
  });

  it('reuses a reasonable inbound request id', async () => {
    const { context, response } = createHttpContext('inbound-trace-id-123');
    const next: CallHandler = { handle: jest.fn(() => of({ ok: true })) };

    await firstValueFrom(new RequestIdInterceptor().intercept(context, next));

    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'inbound-trace-id-123');
  });

  it('replaces an oversized inbound request id', async () => {
    const { context, response } = createHttpContext('x'.repeat(129));
    const next: CallHandler = { handle: jest.fn(() => of({ ok: true })) };

    await firstValueFrom(new RequestIdInterceptor().intercept(context, next));

    const calls = response.setHeader.mock.calls as [string, string][];
    const firstCall = calls[0];
    if (!firstCall) {
      throw new Error('Expected setHeader to have been called');
    }
    const value = firstCall[1];
    expect(value).toMatch(UUID_V4_PATTERN);
  });

  it('logs the resolved status when the handler fails', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const { context } = createHttpContext();
    const next: CallHandler = {
      handle: jest.fn(() => throwError(() => new NotFoundException('missing'))),
    };

    await expect(
      firstValueFrom(new RequestIdInterceptor().intercept(context, next)),
    ).rejects.toThrow(NotFoundException);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('GET /api/v1/health/live 404'));
  });

  it('leaves non-http contexts untouched', () => {
    const context = {
      getType: () => 'rpc',
    } as unknown as ExecutionContext;
    const handleMock = jest.fn(() => of({ ok: true }));
    const next: CallHandler = { handle: handleMock };
    const interceptor = new RequestIdInterceptor();

    const result = interceptor.intercept(context, next);

    expect(handleMock).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Object);
    return firstValueFrom(result).then((value) => expect(value).toEqual({ ok: true }));
  });
});
