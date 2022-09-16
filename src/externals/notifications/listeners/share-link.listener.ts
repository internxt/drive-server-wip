import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { ShareLinkCreatedEvent } from '../events/share-link-created.event';
import { HttpClient } from '../../http/http.service';
@Injectable()
export class ShareLinkListener {
  constructor(
    @Inject(HttpClient)
    private http: HttpClient,
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {}

  @OnEvent('share.created')
  async handleShareLinkCreated(event: ShareLinkCreatedEvent) {
    Logger.log(`event ${event.name} handled`, 'ShareLinkListener');
    const apiDriveURL: string = this.configService.get('apis.drive.url');

    const eventData = {
      email: event.user?.email || null,
      key: 'share-file',
      userId: event.user.userId || null,
    };
    const res = await this.http
      .post(apiDriveURL, eventData, {})
      .catch((err) => {
        Logger.error(`eror in event ${event.name}`, err);
      });
    if (res && res.status !== 200) {
      Logger.warn(
        `Post to drive apply referral service failed with status ${
          res.status
        }. Data: ${JSON.stringify(eventData, null, 2)}`,
      );
    }
  }
}
