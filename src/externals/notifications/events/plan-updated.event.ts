import { Request } from 'express';
import { User } from '../../../modules/user/user.domain';
import { Event } from './event';

export class PlanUpdatedEvent extends Event {
  req?: Request;
  user: User;

  constructor(user: User, req?: Request) {
    super(PlanUpdatedEvent.id, {});
    this.user = user;
    this.req = req;
  }

  static get id(): string {
    return 'plan-updated';
  }
}
