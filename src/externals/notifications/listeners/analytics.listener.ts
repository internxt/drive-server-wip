import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Analytics, { AnalyticsTrackName } from '../../../lib/analytics';
import { ShareLinkCreatedEvent } from '../events/share-link-created.event';
import { RequestContext } from '../../../lib/request-context';
import { InvitationAcceptedEvent } from '../events/invitation-accepted.event';

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
  @OnEvent('invitation.accepted')
  async handleOnInvitationAccepted(event: InvitationAcceptedEvent) {
    Logger.log(`event ${event.name} handled`, 'AnalyticsListener');

    const { whoInvitesEmail, whoInvitesUuid, invitedUuid } = event;

    this.analytics.track({
      userId: invitedUuid,
      event: AnalyticsTrackName.InvitationAccepted,
      properties: { sent_by: whoInvitesEmail },
    });

    this.analytics.identify({
      userId: invitedUuid,
      traits: { referred_by: whoInvitesUuid },
    });
  }
}
