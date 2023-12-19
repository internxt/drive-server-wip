import { HttpStatus } from '@nestjs/common';
import { AttemptChangeEmailException } from './attempt-change-email.exception';

export class AttemptChangeEmailHasExpiredException extends AttemptChangeEmailException {
  constructor(
    message = 'Attempt change email has expired',
    statusCode = HttpStatus.BAD_REQUEST,
    code = 'ATTEMPT_CHANGE_EMAIL_HAS_EXPIRED',
  ) {
    super(message, statusCode, code);
  }
}
