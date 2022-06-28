import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ShareLinkViewEvent } from '../events/share-link-view.event';
import Analytics, { AnalyticsTrackName } from 'src/lib/analytics';
import { ShareLinkCreatedEvent } from '../events/share-link-created.event';
import { RequestContext } from 'src/lib/request-context';

@Injectable()
export class AnalyticsListener {
  analytics: Analytics;
  constructor() {
    this.analytics = Analytics.getInstance();
  }
  @OnEvent('share.created')
  async handleOnShareLinkCreated(event: ShareLinkCreatedEvent) {
    Logger.log(`event ${event.name} handled`, 'AnalyticsListener');

    const { user, share, request } = event;
    const requestContext = new RequestContext(request);
    this.analytics.track({
      userId: user.uuid,
      event: AnalyticsTrackName.ShareLinkCopied,
      properties: {
        owner: share.user.username,
        item_type: share.isFolder ? 'folder' : 'file',
        size: share.item.size,
        extension: share.item.type,
      },
      context: await requestContext.getContext(),
    });
  }
  @OnEvent('share.view')
  async handleOnShareLinkView(event: ShareLinkCreatedEvent) {
    Logger.log(`event ${event.name} handled`, 'AnalyticsListener');

    const { user, share, request } = event;
    const requestContext = new RequestContext(request);
    this.analytics.track({
      userId: user.uuid,
      event: AnalyticsTrackName.ShareLinkViewed,
      properties: {
        views: share.views,
        times_valid: share.timesValid,
        folder_id: share.isFolder ? share.item.id : null,
        file_id: !share.isFolder ? share.item.id : null,
      },
      context: await requestContext.getContext(),
    });
  }
}
