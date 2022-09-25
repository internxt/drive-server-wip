import AnalyticsSegment from 'analytics-node';

import { Logger } from '@nestjs/common';

export enum AnalyticsTrackName {
  ShareLinkViewed = 'Share Link Viewed',
  ShareLinkCopied = 'Share Link Copied',
  DeactivationRequest = 'Deactivation Requested',
  SignUp = 'User Signup',
  InvitationSent = 'Invitation Sent',
  DeactivationConfirmed = 'Deactivation Confirmed',
  ReferralRedeemed = 'Referral Redeemed',
  InvitationAccepted = 'Invitation Accepted',
  UploadCompleted = 'Upload Completed',
  FileDeleted = 'File Deleted',
  SharedLinkItemDownloaded = 'Shared Link Downloaded',
  DownloadCompleted = 'Download Completed',
}

export default class Analytics {
  analytics: AnalyticsSegment;
  logger: Logger;
  static instance: Analytics;
  constructor() {
    this.logger = new Logger();
    this.analytics = new AnalyticsSegment(process.env.APP_SEGMENT_KEY);
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new Analytics();
    }
    return this.instance;
  }

  track(params: any) {
    try {
      this.analytics.track(params);
    } catch (err: unknown) {
      this.logger.error(err);
    }
  }

  identify(params: any) {
    try {
      this.analytics.identify(params);
    } catch (err: unknown) {
      this.logger.error(err);
    }
  }

  page(params: any) {
    try {
      this.analytics.page(params);
    } catch (err: unknown) {
      this.logger.error(err);
    }
  }
}
