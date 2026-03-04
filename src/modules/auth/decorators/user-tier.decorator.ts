import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type Tier } from '../../feature-limit/domain/tier.domain';

export const userTierFactory = (_, ctx: ExecutionContext): Tier | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return req.authInfo?.tier;
};

export const UserTier = createParamDecorator(userTierFactory);
