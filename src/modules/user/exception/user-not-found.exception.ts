import { UserException } from './user.exception';

export class UserNotFoundException extends UserException {
  constructor(message?: string) {
    super(message ?? 'User: not found');
  }
}
