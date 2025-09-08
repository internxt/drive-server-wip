import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationEvent } from '../events/notification.event';
import { ConfigService } from '@nestjs/config';
import { HttpClient } from '../../http/http.service';
import { isAxiosError } from 'axios';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    @Inject(HttpClient)
    private readonly http: HttpClient,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  @OnEvent('notification.*')
  async handleNotificationEvent(event: NotificationEvent) {
    const apiNotificationURL: string = this.configService.get(
      'apis.notifications.url',
    );
    const headers = {
      'X-API-KEY': this.configService.get('apis.notifications.key'),
    };
    const eventData = {
      event: event.event,
      payload: event.payload,
      email: event.email,
      clientId: event.clientId,
      userId: event.userId,
    };

    try {
      const res = await this.http.post(apiNotificationURL, eventData, {
        headers,
      });

      if (res && res.status !== 201) {
        this.logger.warn(
          {
            eventName: event.name,
            eventData,
            status: res.status,
          },
          '[NOTIFICATIONS_ERROR] Notification did not returned the expected result!',
        );
      }
    } catch (error) {
      const errorData = {
        message: error.message,
        stack: error.stack,
      };

      if (isAxiosError(error)) {
        errorData['url'] = error.config?.url;
      }

      this.logger.error(
        {
          eventName: event.name,
          errorMessage: errorData.message,
          eventData,
          errorData,
        },
        '[NOTIFICATIONS_ERROR] There was an error while sending a notification',
      );
    }
  }
}
