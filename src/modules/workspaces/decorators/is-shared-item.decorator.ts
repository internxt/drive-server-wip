import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IsSharedItemWorkspace = createParamDecorator(
  (_, ctx: ExecutionContext): boolean => {
    const request = ctx.switchToHttp().getRequest();
    return request.isSharedItem || false;
  },
);
