import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Tier } from '../../feature-limit/domain/tier.domain';

export const userTierFactory = (_, ctx: ExecutionContext): Tier | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return req.authInfo?.tier;
};

export const UserTier = createParamDecorator(userTierFactory);
