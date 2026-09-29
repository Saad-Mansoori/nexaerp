import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const TENANT_REQUIRED_KEY = 'tenantRequired';

export const RequireTenant = () => SetMetadata(TENANT_REQUIRED_KEY, true);

export const CurrentTenant = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenantContext?.tenantId;
});

export const CurrentMembership = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenantContext?.membershipId;
});

export const CurrentUserId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenantContext?.userId;
});
