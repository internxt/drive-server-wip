import { HttpStatus } from '@nestjs/common';
import { AttemptChangeEmailException } from './attempt-change-email.exception';

export class AttemptChangeEmailAlreadyVerifiedException extends AttemptChangeEmailException {
  constructor(
    message = 'Attempt change email already verified',
    statusCode = HttpStatus.BAD_REQUEST,
    code = 'ATTEMPT_CHANGE_EMAIL_ALREADY_VERIFIED',
  ) {
    super(message, statusCode, code);
  }
}
