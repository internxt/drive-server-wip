import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const BehalfUserDecorator = createParamDecorator(
  async (_, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();

    return req?.behalfUser;
  },
);
