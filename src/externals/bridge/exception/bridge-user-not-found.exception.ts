import { HttpStatus } from '@nestjs/common';
import { BridgeException } from './bridge.exception';

export class BridgeUserNotFoundException extends BridgeException {
  constructor(
    message = 'User: not found',
    statusCode = HttpStatus.NOT_FOUND,
    code = 'USER_NOT_FOUND',
  ) {
    super(message, statusCode, code);
  }
}
