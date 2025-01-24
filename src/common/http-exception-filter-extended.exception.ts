import { Catch, Logger, HttpException, ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class ExtendedHttpExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(ExtendedHttpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const request = ctx.getRequest();

    if (!(exception instanceof HttpException)) {
      const errorResponse = {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message: (exception as Error)?.message,
        stack: (exception as Error)?.stack,
        body: request.body || {},
        user: { email: request?.user?.email, uuid: request?.user?.uuid },
      };

      this.logger.error(
        `[UNEXPECTED_ERROR] - Details: ${JSON.stringify(errorResponse)}`,
      );
    }

    super.catch(exception, host);
  }
}
