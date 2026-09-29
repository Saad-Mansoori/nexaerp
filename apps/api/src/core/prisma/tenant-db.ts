import { PrismaClient } from '../../generated/prisma/client.js';

export const TENANT_CONTEXT_KEY = 'app.current_tenant_id';

export function createTenantExtension(tenantId: string) {
  return PrismaClient.prototype.$extends({
    name: 'tenant-scoping',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          const tenantScopedModels = [
            'TenantMembership',
            'Role',
            'RolePermission',
            'MembershipRole',
            'AuditLog',
            'User',
          ];

          if (!tenantScopedModels.includes(model)) {
            return query(args);
          }

          const isCreate = operation === 'create';
          const isFind = operation.startsWith('find');
          const isUpdate = operation.startsWith('update');
          const isDelete = operation.startsWith('delete');
          const isAggregate =
            operation === 'aggregate' || operation === 'groupBy' || operation === 'count';

          if (isCreate) {
            if (!args.data) {
              args.data = {};
            }
            const data = args.data as Record<string, unknown>;
            if (typeof data === 'object' && data !== null && !('tenantId' in data)) {
              data.tenantId = tenantId;
            }
          }

          if (isFind || isUpdate || isDelete || isAggregate) {
            if (!args.where) {
              args.where = {};
            }
            const where = args.where as Record<string, unknown>;
            if (typeof where === 'object' && where !== null && !('tenantId' in where)) {
              where.tenantId = tenantId;
            }
          }

          return query(args);
        },
      },
    },
  });
}

type PrismaClientOrTransaction =
  PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>;

export type TenantDb = ReturnType<typeof createTenantExtension>;

export function createTenantDb(prisma: PrismaClientOrTransaction, tenantId: string): TenantDb {
  return createTenantExtension(tenantId)(prisma);
}

export async function runWithTenantContext<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: TenantDb) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL "${TENANT_CONTEXT_KEY}" = $1`, tenantId);
    return fn(createTenantDb(tx, tenantId));
  });
}

export async function runWithTenantContextReadOnly<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: TenantDb) => Promise<T>,
): Promise<T> {
  const tenantDb = createTenantDb(prisma, tenantId);
  await prisma.$executeRawUnsafe(`SET LOCAL "${TENANT_CONTEXT_KEY}" = $1`, tenantId);
  return fn(tenantDb);
}
