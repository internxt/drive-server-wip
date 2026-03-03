import { type User } from '../../../modules/user/user.domain';
import { Event } from './event';

export interface UserMaybeWithoutUUID {
  email: User['email'];
  uuid?: string;
}

export class SignUpErrorEvent extends Event {
  user: UserMaybeWithoutUUID;
  err: Error;

  constructor(user: UserMaybeWithoutUUID, err: Error) {
    super(SignUpErrorEvent.id, {});
    this.user = user;
    this.err = err;
  }

  static get id(): string {
    return 'signup-error';
  }
}
