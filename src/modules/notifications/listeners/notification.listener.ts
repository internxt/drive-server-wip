import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationEvent } from '../events/notification.event';
import { map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationListener {
  constructor(
    private http: HttpService,
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {}

  @OnEvent('notification.*')
  async handleNotificationEvent(event: NotificationEvent) {
    Logger.log(`event ${event.name} handleded`, 'NotificationListener');
    const apiNotificationURL: string = this.configService.get(
      'apis.notifications.url',
    );
    const headers = {
      'X-API-KEY': this.configService.get('apis.notifications.key') as string,
    };
    const eventData = {
      event: event.name,
      payload: event.payload,
      email: event.email,
      clientId: event.clientId,
    };
    const res = await this.http
      .post(apiNotificationURL, eventData, {
        headers,
      })
      .toPromise()
      .catch((err) => {
        Logger.error(`eror in event ${event.name}`, err);
      });
    if (res && res.status !== 201) {
      Logger.warn(
        `Post to notifications service failed with status ${
          res.status
        }. Data: ${JSON.stringify(eventData, null, 2)}`,
      );
    }
  }
}
