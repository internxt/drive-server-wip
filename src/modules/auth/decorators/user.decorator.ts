import { createParamDecorator, ExecutionContext, Inject } from '@nestjs/common';
import jwt from 'jsonwebtoken';

export const User = createParamDecorator(async (_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  if (!req.user && req.headers.authorization) {
    const auth = req.headers.authorization.split('Bearer ')[1];
    const authDecoded: any = jwt.decode(auth);
    return authDecoded.payload;
  }

  return req.user;
});
