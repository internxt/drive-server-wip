import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
const newrelic = require('newrelic')

/**
 * Only for the headers, the instrumentation is not done directly here
 */
@Injectable()
export class NewRelicInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();

    const rawClient = req.headers['internxt-client'];
    const rawVersion = req.headers['internxt-version'];

    if (rawClient) {
      newrelic.addCustomAttribute(
        'internxtClient',
        String(Array.isArray(rawClient) ? rawClient[0] : rawClient).slice(0, 50),
      );
    }

    if (rawVersion) {
      newrelic.addCustomAttribute(
        'internxtVersion',
        String(Array.isArray(rawVersion) ? rawVersion[0] : rawVersion).slice(0, 15),
      );
    }

    console.log(rawClient, rawVersion)

    return next.handle();
  }
}
