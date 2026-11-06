import { GoneException, HttpStatus } from '@nestjs/common';

export const ENDPOINT_DEPRECATED = 'ENDPOINT_DEPRECATED';

export class DeprecatedEndpointException extends GoneException {
  constructor(message = 'This endpoint is deprecated') {
    super({
      message,
      error: 'Gone',
      statusCode: HttpStatus.GONE,
      errorCode: ENDPOINT_DEPRECATED,
    });
  }
}
