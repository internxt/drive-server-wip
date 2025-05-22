import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../user/user.domain';

export const requesterFactory = (_, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest();
  return req.requester ?? req.user;
};

export const Requester = createParamDecorator(requesterFactory);
