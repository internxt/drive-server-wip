import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Analytics, { AnalyticsTrackName } from '../../../lib/analytics';
import { RequestContext } from '../../../lib/request-context';
import { InvitationAcceptedEvent } from '../events/invitation-accepted.event';
import { ReferralRedeemedEvent } from '../events/referral-redeemed.event';
import { SignUpSuccessEvent } from '../events/sign-up-success.event';

import geoip from 'geoip-lite';
import DeviceDetector from 'node-device-detector';
import { Request } from 'express';
import { DeactivationRequestEvent } from '../events/deactivation-request.event';
import { ClientEnum } from '../../../common/enums/platform.enum';

const deviceDetector = new DeviceDetector();

function getErrorMessage(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  } else {
    return 'No message';
  }
}

function getDeviceContext(req: Request) {
  const userAgent = req.headers['user-agent'];
  let deviceContext = {};
  try {
    if (userAgent) {
      const deviceDetected = deviceDetector.detect(userAgent);
      const os = {
        version: deviceDetected.os.version,
        name: deviceDetected.os.name,
        short_name: deviceDetected.os.short_name,
        family: deviceDetected.os.family,
      };
      const device = {
        type: deviceDetected.device.type,
        manufacturer: deviceDetected.device.brand,
        model: deviceDetected.device.model,
        brand: deviceDetected.device.brand,
        brand_id: deviceDetected.device.id,
      };
      const client = deviceDetected.client;

      deviceContext = {
        os,
        device,
        client,
      };
    }
  } catch (err) {
    Logger.error(JSON.stringify({ err }), 'AnalyticsListener.getDeviceContext');
  }

  return deviceContext;
}

export async function getContext(req: Request) {
  const ipaddress =
    req.header('x-forwarded-for') || req.socket.remoteAddress || '';
  const location = await getLocation(ipaddress).catch((err) =>
    Logger.warn(JSON.stringify({ err }), 'AnalyticsListener.getContext'),
  );

  const campaign = getCampaign(req);

  const app = {
    name: req.headers['internxt-client'],
    version: req.headers['internxt-version'],
  };

  const deviceContext = getDeviceContext(req);

  const context = {
    app,
    campaign,
    ip: ipaddress,
    location,
    userAgent: req.headers['user-agent'],
    locale: { language: req.headers['accept-language'] },
    ...deviceContext,
  };

  return context;
}

function getUTM(referrer: any) {
  const campaign = Object.create({});
  if (typeof referrer === 'string') {
    const { searchParams } = new URL(referrer);
    const UTMS = [
      'utm_name',
      'utm_source',
      'utm_medium',
      'utm_content',
      'utm_id',
    ];
    UTMS.forEach((utm) => {
      if (searchParams.has(utm)) {
        campaign[utm] = searchParams.get(utm);
      }
    });
  }
  return campaign;
}

export function getAppsumoAffiliate(user: any) {
  const { appsumoDetails } = user;
  if (appsumoDetails) {
    return {
      affiliate_name: 'appsumo',
    };
  }
  return false;
}

export function getAffiliate(referrer: any) {
  const affiliate = Object.create({});
  if (typeof referrer === 'string') {
    const { searchParams } = new URL(referrer);
    if (searchParams.has('irclickid')) {
      affiliate.affiliate_id = searchParams.get('irclickid');
      affiliate.affiliate_name = 'impact';
    }
  }

  return affiliate;
}

export function getCampaign(req: Request) {
  const campaign = getUTM(req.headers.referrer);
  return campaign;
}

export async function getLocation(ipaddress: string): Promise<Location> {
  let location = null;
  try {
    location = await geoip.lookup(ipaddress);
    if (!location) {
      throw Error('No location available');
    }
  } catch (err) {
    throw new Error(getErrorMessage(err));
  }
  return {
    country: location.country,
    region: location.region,
    city: location.city,
    timezone: location.timezone,
  } as unknown as Location;
}

@Injectable()
export class AnalyticsListener {
  private readonly logger = new Logger(AnalyticsListener.name);
  analytics: Analytics;

  constructor() {
    this.analytics = Analytics.getInstance();
  }

  @OnEvent('invitation.accepted')
  async handleOnInvitationAccepted(event: InvitationAcceptedEvent) {
    this.logger.log(`event ${event.name} handled`);

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

  @OnEvent('referral.redeemed')
  async handleOnReferralRedeemed(event: ReferralRedeemedEvent) {
    this.logger.log(`event ${event.name} handled`);

    const { uuid, referralKey } = event;

    this.analytics.track({
      userId: uuid,
      event: AnalyticsTrackName.ReferralRedeemed,
      properties: {
        name: referralKey,
      },
    });
  }

  @OnEvent(SignUpSuccessEvent.id)
  async handleSignUp(event: SignUpSuccessEvent) {
    this.logger.log(`event ${event.name} handled`);

    const { user, req } = event;

    const inxtClient = req.headers['internxt-client'];

    if (inxtClient === ClientEnum.Web) {
      return;
    }
    const userId = user.uuid;
    const { sharedWorkspace, name, lastname } = user;

    const affiliate =
      getAppsumoAffiliate(user) || getAffiliate(req.headers.referrer);
    const context = await getContext(req);
    const location = context.location;

    this.analytics.identify({
      userId,
      traits: {
        shared_workspace: sharedWorkspace,
        name,
        last_name: lastname,
        affiliate,
        usage: 0,
        ...affiliate,
        ...location,
      },
      context,
    });

    this.analytics.track({
      userId,
      event: AnalyticsTrackName.SignUp,
      properties: {
        shared_workspace: sharedWorkspace,
        ...affiliate,
      },
      context,
    });
  }

  @OnEvent(DeactivationRequestEvent.id)
  async handleDeactivationRequest(event: SignUpSuccessEvent) {
    this.logger.log(`event ${event.name} handled`);

    const { user, req } = event;

    const context = await getContext(req);

    this.analytics.track({
      userId: user.uuid,
      event: AnalyticsTrackName.DeactivationRequest,
      context,
    });
  }
}
