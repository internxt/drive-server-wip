import { createParamDecorator, ExecutionContext, Inject } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { UserUseCases } from 'src/modules/user/user.usecase';

export const User = createParamDecorator(async (_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  const auth = req.headers.authorization.split('Bearer ')[1];
  const authDecoded: any = jwt.decode(auth);
  return req.user || authDecoded;
});
