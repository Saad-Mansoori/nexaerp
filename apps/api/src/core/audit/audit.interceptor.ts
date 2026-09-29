import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';

import { AuditService } from './audit.service.js';
import { AUDIT_KEY, type AuditOptions } from './audit.decorator.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    const auditOptions = this.reflector.get<AuditOptions>(AUDIT_KEY, handler);

    if (!auditOptions) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (result) => {
        try {
          const entityId = await auditOptions.getEntityId(result);
          const metadata = auditOptions.getMetadata
            ? await auditOptions.getMetadata([request.body, request.params, request.query])
            : undefined;

          await this.auditService.log({
            action: auditOptions.action,
            entity: auditOptions.entity,
            entityId,
            metadata,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          });
        } catch (error) {
          console.error('Audit interceptor error:', error);
        }
      }),
    );
  }
}
