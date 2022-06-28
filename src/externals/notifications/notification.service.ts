import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Event } from './events/event';

@Injectable()
export class NotificationService {
  constructor(private eventEmitter: EventEmitter2) {}
  add(event: Event): void {
    this.eventEmitter.emit(event.name, event);
  }
}
