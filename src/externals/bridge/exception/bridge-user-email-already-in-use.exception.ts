import { HttpStatus } from '@nestjs/common';
import { BridgeException } from './bridge.exception';

export class BridgeUserEmailAlreadyInUseException extends BridgeException {
  constructor(
    message = 'User: email already in use',
    statusCode = HttpStatus.BAD_REQUEST,
    code = 'USER_EMAIL_ALREADY_IN_USE',
  ) {
    super(message, statusCode, code);
  }
}
