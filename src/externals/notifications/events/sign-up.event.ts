import { Request } from 'express';

import { UserAttributes } from '../../../modules/user/user.domain';
import { Event } from './event';

export class SignUpEvent extends Event {
  req: Request;
  user: UserAttributes;

  constructor(user: UserAttributes, req: Request) {
    super('signup', {});
    this.user = user;
    this.req = req;
  }
}
