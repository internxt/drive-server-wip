import { HttpStatus } from '@nestjs/common';
import { BaseHttpException } from 'src/common/base-http.exception';

export class BridgeException extends BaseHttpException {
  constructor(
    message = 'An error occurred while communicating with the bridge',
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    code = 'BRIDGE_EXCEPTION',
  ) {
    super(`[Bridge] -> ${message}`, statusCode, code);
  }
}
