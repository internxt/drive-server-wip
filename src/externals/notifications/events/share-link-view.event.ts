import { Request } from 'express';
import { Share } from 'src/modules/share/share.domain';
import { User } from 'src/modules/user/user.domain';
import { Event } from './event';

export class ShareLinkViewEvent extends Event {
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
