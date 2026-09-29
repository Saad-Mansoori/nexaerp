import { CallHandler, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import type { NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { catchError, Observable, tap } from 'rxjs';

import { resolveHttpStatus } from '../errors/problem-details.map.js';

export const REQUEST_ID_HEADER = 'x-request-id';

const MAX_INBOUND_REQUEST_ID_LENGTH = 128;

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const inbound = request.header(REQUEST_ID_HEADER);
    const requestId =
      inbound !== undefined &&
      inbound.trim().length > 0 &&
      inbound.length <= MAX_INBOUND_REQUEST_ID_LENGTH
        ? inbound
        : randomUUID();
    response.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = Date.now();
    const logCompletion = (status: number): void => {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `${request.method} ${request.url} ${status} ${durationMs}ms requestId=${requestId}`,
      );
    };

    return next.handle().pipe(
      tap(() => logCompletion(response.statusCode)),
      catchError((error: unknown) => {
        logCompletion(resolveHttpStatus(error));
        throw error;
      }),
    );
  }
}
