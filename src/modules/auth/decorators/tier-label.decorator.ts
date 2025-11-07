import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TierLabel = createParamDecorator(
  (_, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.authInfo?.tierLabel;
  },
);
