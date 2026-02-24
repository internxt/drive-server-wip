import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const IsSharedItem = createParamDecorator(
  (_, ctx: ExecutionContext): boolean => {
    const request = ctx.switchToHttp().getRequest();
    return request.isSharedItem ?? false;
  },
);
