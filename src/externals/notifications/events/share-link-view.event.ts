import { Share } from 'src/modules/share/share.domain';
import { User } from 'src/modules/user/user.domain';
import { Event } from './event';

export class ShareLinkViewEvent extends Event {
  user?: User;
  context?: any;
  share: Share;
  constructor(
    name: string,
    user: User,
    share: Share,
    context: any,
    payload: Record<string, any>,
  ) {
    super(name, payload);
    this.user = user;
    this.share = share;
    this.context = context;
  }
}
