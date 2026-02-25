import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type User } from '../../user/user.domain';

export const requesterFactory = (_, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest();
  return req.requester ?? req.user;
};

export const Requester = createParamDecorator(requesterFactory);
