import {
  ExceptionFilter,
  ArgumentsHost,
  Catch,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { BaseHttpException } from 'src/common/base-http.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const res = exception.getResponse();

      response.status(exception.getStatus()).send({
        timestamps: new Date().toISOString(),
        path: request.url,
        ...(typeof res === 'string' ? { error: res } : res),
      });
    } else if (exception instanceof BaseHttpException) {
      response.status(exception.statusCode).send({
        timestamps: new Date().toISOString(),
        path: request.url,
        statusCode: exception.statusCode,
        code: exception.code,
        error: exception.message,
      });
    } else {
      this.logger.error(
        `
        UNHANDLE ERROR: 
        
        ${JSON.stringify(exception)}
        `,
      );

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        timestamps: new Date().toISOString(),
        path: request.url,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        error: 'Internal server error',
      });
    }
  }
}
