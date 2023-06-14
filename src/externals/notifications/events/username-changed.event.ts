import { User } from '../../../modules/user/user.domain';
import { Event } from './event';

export class UsernameChangedEvent extends Event {
  constructor(readonly user: User, readonly payload: { newUsername: string }) {
    super(UsernameChangedEvent.id, payload);
  }

  static get id() {
    return 'username-changed';
  }
}
