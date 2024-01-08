import { HttpStatus } from '@nestjs/common';
import { AttemptChangeEmailException } from './attempt-change-email.exception';

export class AttemptChangeEmailNotFoundException extends AttemptChangeEmailException {
  constructor(
    message = 'Attempt change email not found',
    statusCode = HttpStatus.NOT_FOUND,
    code = 'ATTEMPT_CHANGE_EMAIL_NOT_FOUND',
  ) {
    super(message, statusCode, code);
  }
}
