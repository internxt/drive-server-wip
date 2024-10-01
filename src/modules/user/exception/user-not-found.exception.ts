import { HttpStatus } from '@nestjs/common';
import { UserException } from './user.exception';

export class UserNotFoundException extends UserException {
  constructor(message?: string) {
    super(message ?? 'not found', HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');
  }
}
