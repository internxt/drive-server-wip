import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Client = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return String(req.headers['internxt-client-id']);
});
