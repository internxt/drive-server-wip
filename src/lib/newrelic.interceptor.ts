import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import newrelic from 'newrelic';

/**
 * Only for the headers, the instrumentation is not done directly here
 */
@Injectable()
export class NewRelicInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request & { id: string }>();
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

    return next.handle();
  }
}
