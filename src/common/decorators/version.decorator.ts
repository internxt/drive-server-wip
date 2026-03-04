import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const Version = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return String(req.headers['internxt-version']);
});
