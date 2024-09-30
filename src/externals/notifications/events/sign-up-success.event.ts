import { Request } from 'express';

import { User } from '../../../modules/user/user.domain';
import { Event } from './event';
export class SignUpSuccessEvent extends Event {
  req?: Request;
  user: User;

  constructor(user: User, req?: Request) {
    super(SignUpSuccessEvent.id, {});
    this.user = user;
    this.req = req;
  }

  static get id(): string {
    return 'signup-success';
  }
}
