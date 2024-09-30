import { Event } from './event';

export class NotificationEvent extends Event {
  email: string;
  clientId: string;
  userId: string;
  event: string;

  constructor(
    name: string,
    payload: Record<string, any>,
    email: string,
    clientId: string,
    userId: string,
    event?: string,
  ) {
    super(name, payload);
    this.email = email;
    this.clientId = clientId;
    this.userId = userId;
    this.event = event;
  }
}
