import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
