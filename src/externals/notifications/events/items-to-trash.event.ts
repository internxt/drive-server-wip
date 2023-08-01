import { NotificationEvent } from './notification.event';

export class ItemsToTrashEvent extends NotificationEvent {
  constructor(payload, email, clientId, userId) {
    super('notification.itemsToTrash', payload, email, clientId, userId);
  }
}
