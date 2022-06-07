import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvent } from './events/notification.event';

@Injectable()
export class NotificationService {
  constructor(private eventEmitter: EventEmitter2) {}
  add(event: NotificationEvent): Promise<void> {
    this.eventEmitter.emit(event.name, event);
    return;
  }
}
