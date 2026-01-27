import {
  Catch,
  HttpException,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseError as SequelizeError } from 'sequelize';
import { AxiosError } from 'axios';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class HttpGlobalExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(HttpGlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    try {
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

      const requestId = request.id;

      if (this.isDatabaseConnectionError(exception)) {
        this.logDatabaseConnectionError(exception, request);

        return httpAdapter.reply(
          response,
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'Service temporarily unavailable',
            requestId,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.logUnexpectedError(exception, request);

      return httpAdapter.reply(
        response,
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
          requestId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } catch (error) {
      const errorDetails = {
        user: {
          email: request?.user?.email,
          uuid: request?.user?.uuid,
          id: request?.user?.id,
        },
        method: request.method,
        path: request.url,
        error: {
          message: error.message,
          stack: error.stack,
        },
      };

      this.logger.error(
        errorDetails,
        'Unexpected error in HttpGlobalExceptionFilter',
      );
      // If something goes wrong, let the default exception handler take over
      return super.catch(error, host);
    }
  }

  isExceptionObject(err: any): err is Error {
    return (
      err !== null &&
      err !== undefined &&
      typeof err === 'object' &&
      'message' in err
    );
  }

  private isDatabaseConnectionError(exception: any): boolean {
    const connectionErrorNames = [
      'SequelizeConnectionAcquireTimeoutError',
      'SequelizeConnectionError',
      'SequelizeConnectionRefusedError',
      'SequelizeConnectionTimedOutError',
    ];

    return connectionErrorNames.includes(exception?.name);
  }

  private logDatabaseConnectionError(exception: any, request) {
    const errorResponse = {
      name: exception.name,
      path: request.url,
      errorType: 'DATABASE_CONNECTION_ERROR',
      method: request.method,
      user: {
        uuid: request?.user?.uuid,
      },
      error: {
        message: exception.message,
      },
    };

    this.logger.error(errorResponse, 'DATABASE_CONNECTION_ERROR');
  }

  logUnexpectedError(exception: any, request) {
    let errorSubtype = '';
    if (exception instanceof SequelizeError) {
      errorSubtype = 'DATABASE';
    } else if (exception instanceof AxiosError) {
      errorSubtype = 'EXTERNAL_SERVICE';
    }

    const errorCategory = errorSubtype
      ? `UNEXPECTED_ERROR/${errorSubtype}`
      : 'UNEXPECTED_ERROR';

    const errorResponse = {
      name: exception.name,
      path: request.url,
      errorType: errorCategory,
      method: request.method,
      body: request.body ?? {},
      user: {
        email: request?.user?.email,
        uuid: request?.user?.uuid,
        id: request?.user?.id,
      },
      error: {
        message: exception.message,
        stack: exception.stack,
      },
    };

    this.logger.error(errorResponse, errorCategory);
  }
}
