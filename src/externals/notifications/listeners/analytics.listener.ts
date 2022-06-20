import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ShareLinkViewEvent } from '../events/share-link-view.event';
import Analytics, { AnalyticsTrackName } from 'src/lib/analytics';

@Injectable()
export class AnalyticsListener {
  analytics: Analytics;
  constructor() {
    this.analytics = Analytics.getInstance();
  }
  @OnEvent('share.view')
  async handleOnShareLinkView(event: ShareLinkViewEvent) {
    Logger.log(`event ${event.name} handled`, 'AnalyticsListener');

    const { user, share, context } = event;
    this.analytics.track({
      userId: user.uuid,
      event: AnalyticsTrackName.ShareLinkViewed,
      properties: {
        views: share.views,
        times_valid: share.timesValid,
        folder_id: share.isFolder ? share.item.id : null,
        file_id: !share.isFolder ? share.item.id : null,
      },
      context,
    });
  }
}
