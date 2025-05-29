import {
  Catch,
  Logger,
  HttpException,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { BaseError as SequelizeError } from 'sequelize';
import { AxiosError } from 'axios';
import { BaseExceptionFilter } from '@nestjs/core';
import { getClientIdFromHeaders } from '../modules/auth/decorators/client.decorator';
import { v4 } from 'uuid';

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

      const errorId = v4();
      const errorResponse = {
        timestamp: new Date().toISOString(),
        errorId,
        name: exception.name,
        path: request.url,
        method: request.method,
        body: request.body ?? {},
        user: {
          email: request?.user?.email,
          uuid: request?.user?.uuid,
          id: request?.user?.id,
        },
        client: getClientIdFromHeaders(request),
        error: {
          message: exception.message,
          stack: exception.stack,
          exception,
        },
      };

      let errorSubtype = '';
      if (exception instanceof SequelizeError) {
        errorSubtype = 'DATABASE';
      } else if (exception instanceof AxiosError) {
        errorSubtype = 'EXTERNAL_SERVICE';
      }

      const errorCategory = errorSubtype
        ? `UNEXPECTED_ERROR/${errorSubtype}`
        : 'UNEXPECTED_ERROR';

      this.logger.error(
        `[${errorCategory}] - Details: ${JSON.stringify(errorResponse)}`,
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
    } catch (error) {
      const errorDetails = {
        user: {
          email: request?.user?.email,
          uuid: request?.user?.uuid,
          id: request?.user?.id,
        },
        method: request.method,
        path: request.url,
        message: error.message,
        stack: error.stack,
      };
      this.logger.error(
        `Error in HttpGlobalExceptionFilter: ${JSON.stringify(errorDetails)}`,
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
}
