import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { SignUpSuccessEvent } from '../events/sign-up-success.event';
import { NewsletterService } from '../../newsletter';
import logger, { LogType } from '../../logger';
import { Ids } from '../../logger/ids';
import { SignUpErrorEvent } from '../events/sign-up-error.event';
import { UsernameChangedEvent } from '../events/username-changed.event';
import { UserUseCases } from '../../../modules/user/user.usecase';

@Injectable()
export class AuthListener {
  constructor(
    private readonly newsletterService: NewsletterService,
    private readonly usersUsecase: UserUseCases,
  ) {}

  @OnEvent(SignUpSuccessEvent.id)
  handleSignUpSuccess({ user }: SignUpSuccessEvent) {
    const { email, uuid } = user;

    logger(LogType.Info, {
      user: uuid,
      id: Ids.SignUpEventSuccess,
      entity: { email },
    });

    this.newsletterService
      .subscribe(email)
      .then(() => {
        logger(LogType.Info, {
          user: uuid,
          id: Ids.SubscribeNewsletterSuccess,
        });
      })
      .catch((err) => {
        logger(LogType.Error, {
          user: uuid,
          message: `${err.message}. ${err.stack}`,
          id: Ids.SubscribeNewsletterError,
        });
      });
  }

  @OnEvent(SignUpErrorEvent.id)
  handleSignUpError({ user, err }: SignUpErrorEvent) {
    const { email } = user;

    logger(LogType.Error, {
      user: user.uuid || 'no-uuid',
      id: Ids.SignUpEventError,
      entity: { email },
      message: `${err.message}. ${err.stack}`,
    });
  }

  @OnEvent(UsernameChangedEvent.id)
  handleUsernameChangedEvent({ user }: UsernameChangedEvent) {
    const { uuid } = user;

    logger(LogType.Info, {
      user: uuid,
      id: UsernameChangedEvent.id,
    });

    this.usersUsecase
      .expireUserSession(user)
      .then(() => {
        logger(LogType.Info, {
          user: uuid,
          id: UsernameChangedEvent.id,
        });
      })
      .catch((err) => {
        logger(LogType.Error, {
          user: uuid,
          message: `${err.message}. ${err.stack}`,
          id: UsernameChangedEvent.id,
        });
      });
  }
}
