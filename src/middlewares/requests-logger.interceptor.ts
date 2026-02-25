import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Logger,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import { type Request } from 'express';
import jwt from 'jsonwebtoken';
import { type User } from '../modules/user/user.domain';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();

    let user = req.user as User;

    if (req.headers.authorization && !user) {
      try {
        const userDecoded: any = jwt.decode(
          req.headers.authorization.split(' ')[1],
        );
        if (userDecoded?.email) {
          user = userDecoded.email;
        } else {
          user = userDecoded;
        }
      } catch (e) {
        // no op
      }
    }

    const clientVersion =
      `[${req.headers['internxt-client']} ${req.headers['internxt-version']}]`.trim();

    const authInfo = user?.email
      ? `[AUTH ${user.email}] [TIER ${user.tierId}]`
      : '';

    this.logger.log(
      `[RequestsLogger] [${req.method}] ${req.originalUrl} ${
        authInfo && ` ${authInfo}`
      } ${clientVersion}`,
    );

    return next.handle();
  }
}
