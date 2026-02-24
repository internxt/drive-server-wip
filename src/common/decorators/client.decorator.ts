import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export enum ClientHeaders {
  CLIENT_ID = 'internxt-client-id',
  CLIENT = 'internxt-client',
}

export const getClientIdFromHeaders = (request: Request) => {
  return String(
    request.headers[ClientHeaders.CLIENT_ID] ??
      request.headers[ClientHeaders.CLIENT] ??
      '',
  );
};

export const Client = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return getClientIdFromHeaders(req);
});
