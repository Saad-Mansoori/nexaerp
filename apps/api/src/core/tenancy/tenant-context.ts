import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  userId: string;
  tenantId: string;
  membershipId: string;
}

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

export function getTenantId(): string | undefined {
  return tenantContextStorage.getStore()?.tenantId;
}

export function getUserId(): string | undefined {
  return tenantContextStorage.getStore()?.userId;
}

export function getMembershipId(): string | undefined {
  return tenantContextStorage.getStore()?.membershipId;
}

export function runWithTenantContext<T>(context: TenantContext, fn: () => T): T {
  return tenantContextStorage.run(context, fn);
}
