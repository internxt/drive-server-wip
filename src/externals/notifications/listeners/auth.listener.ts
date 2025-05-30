import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { SignUpSuccessEvent } from '../events/sign-up-success.event';
import { NewsletterService } from '../../newsletter';
import { Ids } from '../../logger/ids';
import { SignUpErrorEvent } from '../events/sign-up-error.event';

@Injectable()
export class AuthListener {
  private readonly logger = new Logger(AuthListener.name);

  constructor(private readonly newsletterService: NewsletterService) {}

  @OnEvent(SignUpSuccessEvent.id)
  handleSignUpSuccess({ user }: SignUpSuccessEvent) {
    const { email, uuid } = user;

    this.logger.log({
      user: uuid,
      id: Ids.SignUpEventSuccess,
      entity: { email },
    });

    this.newsletterService
      .subscribe(email)
      .then(() => {
        this.logger.log({
          user: uuid,
          id: Ids.SubscribeNewsletterSuccess,
        });
      })
      .catch((err) => {
        this.logger.error({
          user: uuid,
          message: `${err.message}. ${err.stack}`,
          id: Ids.SubscribeNewsletterError,
        });
      });
  }

  @OnEvent(SignUpErrorEvent.id)
  handleSignUpError({ user, err }: SignUpErrorEvent) {
    const { email } = user;

    this.logger.error({
      user: user.uuid || 'no-uuid',
      id: Ids.SignUpEventError,
      entity: { email },
      message: `${err.message}. ${err.stack}`,
    });
  }
}
