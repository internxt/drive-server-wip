import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { SignUpSuccessEvent } from '../events/sign-up-success.event';
import { NewsletterService } from 'src/externals/newsletter';
// import { InvitationAcceptedEvent } from '../events/invitation-accepted.event';
// import { UserUseCases } from 'src/modules/user/user.usecase';
import logger from 'src/externals/logger';
import { Ids } from 'src/externals/logger/ids';
import { SignUpErrorEvent } from '../events/sign-up-error.event';

@Injectable()
export class AuthListener {
  constructor(private readonly newsletterService: NewsletterService) {}

  @OnEvent(SignUpSuccessEvent.id)
  handleSignUpSuccess({ user }: SignUpSuccessEvent) {
    const { email, uuid } = user;

    logger('log', {
      user: uuid,
      id: Ids.SignUpEventSuccess,
      entity: { email },
    });

    this.newsletterService
      .subscribe(email)
      .then(() => {
        logger('log', {
          user: uuid,
          id: Ids.SubscribeNewsletterSuccess,
        });
      })
      .catch((err) => {
        logger('error', {
          user: uuid,
          message: `${err.message}. ${err.stack}`,
          id: Ids.SubscribeNewsletterError,
        });
      });
  }

  @OnEvent(SignUpErrorEvent.id)
  handleSignUpError({ user, err }: SignUpErrorEvent) {
    const { email } = user;

    logger('error', {
      user: user.uuid || 'no-uuid',
      id: Ids.SignUpEventError,
      entity: { email },
      message: `${err.message}. ${err.stack}`,
    });
  }

  // @OnEvent('invitation.accepted')
  // async handleInvitationAccepted(event: InvitationAcceptedEvent) {
  //   const { invitedUuid, whoInvitesEmail, whoInvitesUuid } = event;

  //   logger('log', {
  //     user: invitedUuid,
  //     id: Ids.ReferralInvitationAcceptedSuccess,
  //     entity: {
  //       referrer: whoInvitesUuid,
  //       referred: invitedUuid,
  //     },
  //   });

  //   this.usersUsecase.invitationAccepted(
  //     who
  //   ).catch((err) => {
  //     logger('error', {
  //       user: invitedUuid,
  //       message: `${err.message}. ${err.stack}`,
  //       id: 'AUTH/SIGNUP/INVITATION',
  //     });
  //   });
  // }
}