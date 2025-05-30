import AnalyticsRudder from '@rudderstack/rudder-sdk-node';

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
  private readonly logger = new Logger(Analytics.name);
  analytics: AnalyticsRudder;

  static instance: Analytics;
  constructor() {
    try {
      this.analytics = new AnalyticsRudder(process.env.ANALYTICS_RUDDER_KEY, {
        dataPlaneUrl: process.env.ANALYTICS_RUDDER_PLAN_URL,
        errorHandler: (err: Error) => {
          const errorResponse = {
            name: err.name,
            path: err.stack,
            message: err.message,
          };

          this.logger.error(
            `Error sending request to rudderStack ${JSON.stringify({ error: errorResponse })}`,
          );
        },
      });
    } catch (err) {
      this.logger.error(`Error initializing analytics: ${err.message}`);
    }
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
      this.logger.error(`track error: ${JSON.stringify(err)}`);
    }
  }

  identify(params: any) {
    try {
      this.analytics.identify(params);
    } catch (err: unknown) {
      this.logger.error(`identify error: ${JSON.stringify({ err })}`);
    }
  }

  page(params: any) {
    try {
      this.analytics.page(params);
    } catch (err: unknown) {
      this.logger.error(`page error: ${JSON.stringify({ err })}`);
    }
  }
}
