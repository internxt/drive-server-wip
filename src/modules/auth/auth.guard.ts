import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { TraceMethod } from '../../common/decorators/newrelic-trace-method.decorator';

@Injectable()
export class AuthGuard extends PassportAuthGuard([JwtStrategy.id]) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  @TraceMethod()
  canActivate(context: ExecutionContext) {
    const handlerContext = context.getHandler();
    const classContext = context.getClass();

    const isPublic = this.reflector.get<boolean>('isPublic', handlerContext);
    const disableGlobalAuth = this.reflector.getAllAndOverride<boolean>(
      'disableGlobalAuth',
      [handlerContext, classContext],
    );

    if (isPublic || disableGlobalAuth) {
      return true;
    }

    return super.canActivate(context);
  }
}
