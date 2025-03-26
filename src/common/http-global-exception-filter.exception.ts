import {
  Catch,
  Logger,
  HttpException,
  ArgumentsHost,
  HttpStatus,
  ExceptionFilter,
} from '@nestjs/common';
import { BaseError as SequelizeError } from 'sequelize';
import { AxiosError } from 'axios';
import { HttpAdapterHost } from '@nestjs/core';
import { getClientIdFromHeaders } from '../modules/auth/decorators/client.decorator';
import { v4 } from 'uuid';

@Catch()
export class HttpGlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpGlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: any, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    //  Errors thrown intentionally by the application
    if (exception instanceof HttpException) {
      const status = exception.getStatus
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

      const res = exception.getResponse();
      const message = this.isExceptionObject(res)
        ? res
        : {
            statusCode: exception.getStatus(),
            message: res,
          };

      return httpAdapter.reply(response, message, status);
    }

    const errorId = v4();
    const errorResponse = {
      timestamp: new Date().toISOString(),
      errorId,
      name: exception.name,
      path: request.url,
      method: request.method,
      body: request.body || {},
      user: { email: request?.user?.email, uuid: request?.user?.uuid },
      client: getClientIdFromHeaders(request),
      message: (exception as Error)?.message,
      stack: (exception as Error)?.stack,
    };

    let errorType = '[UNEXPECTED_ERROR]';
    if (exception instanceof SequelizeError) {
      errorType = '[DATABASE]';
    } else if (exception instanceof AxiosError) {
      errorType = '[EXTERNAL_SERVICE]';
    }

    this.logger.error(
      `${errorType} - Details: ${JSON.stringify(errorResponse)}`,
    );

    return httpAdapter.reply(
      response,
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
        errorId,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  isExceptionObject(err: any): err is Error {
    return (
      err !== null &&
      err !== undefined &&
      typeof err === 'object' &&
      'message' in err
    );
  }
}
