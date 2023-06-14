import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import logger, { LogType } from '../../logger';
import { UsernameChangedEvent } from '../events/username-changed.event';
import { SharedWorkspaceUsecases } from '../../../shared-workspace/shared-workspace.usecase';

@Injectable()
export class SharedWorkspaceListener {
  constructor(
    private readonly sharedWorkspaceUsecases: SharedWorkspaceUsecases,
  ) {}

  @OnEvent(UsernameChangedEvent.id)
  handleUsernameChangedEvent({ user, payload }: UsernameChangedEvent) {
    const { newUsername } = payload;
    const { uuid } = user;

    logger(LogType.Info, {
      user: uuid,
      id: UsernameChangedEvent.id,
    });

    this.sharedWorkspaceUsecases
      .hostChangesUsername(user, newUsername)
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
