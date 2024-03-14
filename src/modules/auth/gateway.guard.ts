import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { RS256JwtStrategy } from '../auth/rs256jwt.strategy';

@Injectable()
export class GatewayGuard extends PassportAuthGuard([RS256JwtStrategy.id]) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
