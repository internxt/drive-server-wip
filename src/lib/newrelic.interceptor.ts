import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import newrelic from 'newrelic';
import { type User } from '../modules/user/user.domain';

/**
 * Only for the headers, the instrumentation is not done directly here
 */
@Injectable()
export class NewRelicInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context
      .switchToHttp()
      .getRequest<Request & { id: string; user?: User | boolean }>();
    const res = context.switchToHttp().getResponse();

    const rawClient = req.headers['internxt-client'];
    const rawVersion = req.headers['internxt-version'];
    const requestId = req.id;

    if (requestId) {
      res.setHeader('x-request-id', requestId);
    }

    if (rawClient) {
      newrelic.addCustomAttribute(
        'internxtClient',
        String(Array.isArray(rawClient) ? rawClient[0] : rawClient).slice(
          0,
          50,
        ),
      );
    }

    if (rawVersion) {
      newrelic.addCustomAttribute(
        'internxtVersion',
        String(Array.isArray(rawVersion) ? rawVersion[0] : rawVersion).slice(
          0,
          15,
        ),
      );
    }

    if (requestId) {
      newrelic.addCustomAttribute('requestId', requestId);
    }

    // Gateway guard has no user
    const user = req.user;
    if (user && typeof user === 'object' && user.id) {
      newrelic.setUserID(String(user.id));
    }

    return next.handle();
  }
}
