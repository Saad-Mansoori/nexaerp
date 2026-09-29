import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { FieldError } from '@nexaerp/shared';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppConfigService } from '../config/app-config.service.js';
import { ProblemDetailsException } from './problem-details.exception.js';
import {
  problemTitle,
  problemType,
  resolveHttpStatus,
  statusCodeToCode,
} from './problem-details.map.js';

interface MappedError {
  status: number;
  detail?: string;
  errors?: FieldError[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    const mapped = this.map(exception);
    const code = statusCodeToCode(mapped.status);
    const isServerFailure = mapped.status >= 500 && !(exception instanceof ProblemDetailsException);

    if (isServerFailure) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
        AllExceptionsFilter.name,
      );
    }

    if (mapped.status === 429) {
      const retryAfterSeconds = Math.max(1, Math.ceil(this.config.throttleTtlMs / 1000));
      response.setHeader('Retry-After', String(retryAfterSeconds));
    }

    const detail =
      mapped.status >= 500 && !(exception instanceof ProblemDetailsException)
        ? 'Internal server error.'
        : mapped.detail;

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(mapped.status).json({
      type: problemType(code),
      title: problemTitle(code),
      status: mapped.status,
      ...(detail !== undefined ? { detail } : {}),
      code,
      instance: request.url,
      ...(mapped.errors !== undefined && mapped.errors.length > 0 ? { errors: mapped.errors } : {}),
    });
  }

  private map(exception: unknown): MappedError {
    if (exception instanceof ProblemDetailsException) {
      return {
        status: exception.httpStatus,
        detail: exception.detail,
        errors: exception.errors,
      };
    }
    if (exception instanceof ZodError) {
      return {
        status: 422,
        detail: 'Request payload failed validation.',
        errors: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail =
        typeof body === 'string'
          ? body
          : typeof (body as { message?: unknown }).message === 'string'
            ? (body as { message: string }).message
            : exception.message;
      return { status, detail };
    }
    return { status: resolveHttpStatus(exception) };
  }
}
