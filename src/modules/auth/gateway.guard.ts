import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { GatewayRS256JwtStrategy } from './gateway-rs256jwt.strategy';

@Injectable()
export class GatewayGuard extends PassportAuthGuard(
  GatewayRS256JwtStrategy.id,
) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
