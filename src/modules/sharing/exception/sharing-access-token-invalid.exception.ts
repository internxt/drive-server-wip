import { ForbiddenException, HttpStatus } from '@nestjs/common';

export const SHARING_ACCESS_TOKEN_INVALID = 'SHARING_ACCESS_TOKEN_INVALID';

export class SharingAccessTokenInvalidException extends ForbiddenException {
  constructor(message = 'Sharing access token is invalid or expired') {
    super({
      message,
      error: 'Forbidden',
      statusCode: HttpStatus.FORBIDDEN,
      errorCode: SHARING_ACCESS_TOKEN_INVALID,
    });
  }
}
