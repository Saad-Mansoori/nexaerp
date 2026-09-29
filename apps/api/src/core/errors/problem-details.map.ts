import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@nexaerp/shared';
import { ZodError } from 'zod';

export const PROBLEM_TYPE_BASE = 'https://nexaerp.dev/problems';

const TITLES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: 'Authentication Required',
  TENANT_REQUIRED: 'Tenant Required',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not Found',
  CONFLICT: 'Conflict',
  VALIDATION_FAILED: 'Validation Failed',
  RATE_LIMITED: 'Rate Limited',
  SERVICE_UNAVAILABLE: 'Service Unavailable',
  INTERNAL: 'Internal Server Error',
};

export function problemType(code: ErrorCode): string {
  return `${PROBLEM_TYPE_BASE}/${code.toLowerCase().replace(/_/g, '-')}`;
}

export function problemTitle(code: ErrorCode): string {
  return TITLES[code];
}

export function statusCodeToCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return 'AUTH_REQUIRED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED';
  }
}

export function resolveHttpStatus(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  if (exception instanceof ZodError) {
    return 422;
  }
  const candidate = exception as { status?: unknown; statusCode?: unknown } | null;
  if (typeof candidate?.status === 'number') {
    return candidate.status;
  }
  if (typeof candidate?.statusCode === 'number') {
    return candidate.statusCode;
  }
  return 500;
}
