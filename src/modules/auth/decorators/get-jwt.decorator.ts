import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const jwtDecoratorFactory = (
  data: unknown,
  ctx: ExecutionContext,
): string => {
  const request = ctx.switchToHttp().getRequest();
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedException('Authorization header is missing');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedException('Invalid authorization header format');
  }

  const token = authHeader.substring(7);

  if (!token) {
    throw new UnauthorizedException('Token is missing');
  }

  return token;
};

export const JwtToken = createParamDecorator(jwtDecoratorFactory);
