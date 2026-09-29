import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditOptions {
  action: string;
  entity: string;
  getEntityId: (result: unknown) => string | Promise<string>;
  getMetadata?: (args: unknown[]) => Record<string, unknown> | Promise<Record<string, unknown>>;
}

export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);
