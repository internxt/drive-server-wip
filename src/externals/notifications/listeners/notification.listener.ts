import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationEvent } from '../events/notification.event';
import { ConfigService } from '@nestjs/config';
import { HttpClient } from '../../http/http.service';

@Injectable()
export class NotificationListener {
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
    const res = await this.http
      .post(apiNotificationURL, eventData, {
        headers,
      })
      .catch((err) => {
        Logger.error(
          `[NOTIFICATIONS_ERROR] Error in event ${event.name}: ${
            err.message
          } Data: ${JSON.stringify(eventData, null, null)}`,
          this.constructor.name,
        );
      });
    if (res && res.status !== 201) {
      Logger.warn(
        `Post to notifications service failed with status ${
          res.status
        }. Data: ${JSON.stringify(eventData, null, null)}`,
        this.constructor.name,
      );
    }
  }
}
