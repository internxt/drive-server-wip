import { Event } from './event';

export class SendLinkCreatedEvent extends Event {
  constructor(payload) {
    super('sendLink.created', payload);
  }
}
