import { Injectable } from '@nestjs/common';
import { NotificationRepository } from './notifications.repository';

@Injectable()
export class NotificationsUseCases {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}
}
