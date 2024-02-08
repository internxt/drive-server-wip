import { HttpStatus } from '@nestjs/common';
import { UserException } from './user.exception';

export class UserEmailAlreadyInUseException extends UserException {
  constructor(email?: string) {
    super(
      `${email} email already in use`,
      HttpStatus.BAD_REQUEST,
      'USER_EMAIL_ALREADY_IN_USE',
    );
  }
}
