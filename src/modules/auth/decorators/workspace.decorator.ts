import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const Workspace = createParamDecorator(
  async (_, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.workspace ?? undefined;
  },
);
