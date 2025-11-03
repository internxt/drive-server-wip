import { ConflictException, HttpStatus } from '@nestjs/common';

export class UserEmailAlreadyInUseException extends ConflictException {
  constructor(email?: string) {
    super(HttpStatus.BAD_REQUEST, `${email} email already in use`);
  }
}
