import { Request } from 'express';
import { Share } from '../../../modules/share/share.domain';
import { User } from '../../../modules/user/user.domain';
import { Event } from './event';

export class ShareLinkCreatedEvent extends Event {
  user?: User;
  request?: Request;
  share: Share;
  constructor(
    name: string,
    user: User,
    share: Share,
    request: Request,
    payload: Record<string, any>,
  ) {
    super(name, payload);
    this.user = user;
    this.share = share;
    this.request = request;
  }
}
